-- Atomic payment, refund, payout, webhook, and reconciliation commands.

create or replace function public.calculate_marketplace_fee(
  p_job_id uuid,
  p_amount_minor bigint
)
returns table(fee_rule_id uuid, fee_minor bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule public.fee_rules;
  v_job public.jobs;
  v_city_id uuid;
  v_fee bigint := 0;
begin
  if p_amount_minor <= 0 then
    raise exception using errcode = '22023', message = 'INVALID_PAYMENT_AMOUNT';
  end if;
  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  select city_id into v_city_id from public.service_requests where id = v_job.request_id;

  select * into v_rule
  from public.fee_rules f
  where f.scope = 'platform_commission'
    and f.currency_code = 'PKR'
    and f.is_active
    and f.effective_from <= now()
    and (f.effective_until is null or f.effective_until > now())
    and (f.service_category_id is null or f.service_category_id = v_job.service_category_id)
    and (f.city_id is null or f.city_id = v_city_id)
  order by
    ((f.service_category_id is not null)::integer + (f.city_id is not null)::integer) desc,
    f.effective_from desc,
    f.created_at desc
  limit 1;

  if found then
    v_fee := case v_rule.fee_type
      when 'percentage' then round(p_amount_minor * v_rule.percentage_basis_points / 10000.0)::bigint
      when 'fixed' then v_rule.fixed_amount_minor
      else round(p_amount_minor * v_rule.percentage_basis_points / 10000.0)::bigint + v_rule.fixed_amount_minor
    end;
    if v_rule.minimum_fee_minor is not null then v_fee := greatest(v_fee, v_rule.minimum_fee_minor); end if;
    if v_rule.maximum_fee_minor is not null then v_fee := least(v_fee, v_rule.maximum_fee_minor); end if;
    v_fee := least(p_amount_minor, greatest(0, v_fee));
    fee_rule_id := v_rule.id;
  else
    fee_rule_id := null;
  end if;
  fee_minor := v_fee;
  return next;
end;
$$;

create or replace function public.ensure_ledger_account(
  p_account_code text,
  p_account_name text,
  p_account_type text,
  p_owner_type text default 'platform',
  p_owner_profile_id uuid default null,
  p_currency_code char(3) default 'PKR'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(
    p_account_code || ':' || p_owner_type || ':' || coalesce(p_owner_profile_id::text, 'platform') || ':' || p_currency_code
  ));
  select id into v_id from public.ledger_accounts
  where account_code = p_account_code
    and owner_type = p_owner_type
    and owner_profile_id is not distinct from p_owner_profile_id
    and currency_code = p_currency_code;
  if found then return v_id; end if;
  insert into public.ledger_accounts (
    account_code, account_name, account_type, owner_type, owner_profile_id, currency_code
  ) values (
    p_account_code, p_account_name, p_account_type, p_owner_type, p_owner_profile_id, p_currency_code
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.create_job_payment_intent(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_provider text,
  p_method_type text,
  p_payment_method_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns public.payment_intents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.jobs;
  v_completion public.job_completions;
  v_existing public.idempotency_keys;
  v_intent public.payment_intents;
  v_fee_rule_id uuid;
  v_fee bigint;
  v_status text;
begin
  if p_method_type not in ('cash', 'manual_bank_transfer') or p_provider not in ('cash', 'manual') then
    raise exception using errcode = '0A000', message = 'ONLINE_PROVIDER_NOT_CONFIGURED';
  end if;
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'payment.create' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_intent from public.payment_intents where id = (v_existing.response_body->>'payment_intent_id')::uuid;
    return v_intent;
  end if;

  select * into v_job from public.jobs where id = p_job_id for update;
  if not found or v_job.customer_id <> p_actor_profile_id then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'completed' or v_job.payment_status not in ('not_due', 'due') then
    raise exception using errcode = '22023', message = 'PAYMENT_NOT_CREATABLE';
  end if;
  select * into v_completion from public.job_completions
  where job_id = p_job_id and customer_decision = 'confirmed';
  if not found then raise exception using errcode = '22023', message = 'COMPLETION_CONFIRMATION_REQUIRED'; end if;
  if exists (select 1 from public.payment_intents where job_id = p_job_id and status in ('paid', 'cash_confirmed', 'partially_refunded', 'refunded')) then
    raise exception using errcode = '23505', message = 'PAYMENT_ALREADY_CONFIRMED';
  end if;
  if p_payment_method_id is not null and not exists (
    select 1 from public.customer_payment_methods
    where id = p_payment_method_id and customer_id = p_actor_profile_id and status = 'active' and deleted_at is null
  ) then raise exception using errcode = '22023', message = 'PAYMENT_METHOD_NOT_AVAILABLE'; end if;

  select fee_rule_id, fee_minor into v_fee_rule_id, v_fee
  from public.calculate_marketplace_fee(p_job_id, v_completion.final_price_minor);
  v_status := 'cash_due';
  insert into public.payment_intents (
    job_id, customer_id, professional_id, payment_method_id, provider, method_type,
    currency_code, amount_minor, platform_fee_minor, professional_amount_minor,
    fee_rule_id, status, idempotency_key, expires_at
  ) values (
    p_job_id, v_job.customer_id, v_job.professional_id, p_payment_method_id, p_provider, p_method_type,
    'PKR', v_completion.final_price_minor, v_fee, v_completion.final_price_minor - v_fee,
    v_fee_rule_id, v_status, p_idempotency_key, now() + interval '14 days'
  ) returning * into v_intent;
  update public.jobs set payment_status = 'due', version = version + 1 where id = p_job_id;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body, resource_type, resource_id
  ) values (
    p_actor_profile_id, 'payment.create', p_idempotency_key, p_request_hash, 201,
    jsonb_build_object('payment_intent_id', v_intent.id), 'payment_intent', v_intent.id
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('payment.due', 'payment_intent', v_intent.id, jsonb_build_object('job_id', p_job_id, 'amount_minor', v_intent.amount_minor));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payment.intent_created', 'payment_intent', v_intent.id,
    jsonb_build_object('method_type', p_method_type, 'amount_minor', v_intent.amount_minor, 'platform_fee_minor', v_fee));
  return v_intent;
end;
$$;

create or replace function public.report_manual_payment(
  p_actor_profile_id uuid,
  p_payment_intent_id uuid,
  p_note text
)
returns public.payment_intents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_intent public.payment_intents;
begin
  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found or v_intent.professional_id <> p_actor_profile_id then
    raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND';
  end if;
  if v_intent.method_type not in ('cash', 'manual_bank_transfer') or v_intent.status <> 'cash_due' then
    raise exception using errcode = '22023', message = 'PAYMENT_NOT_REPORTABLE';
  end if;
  insert into public.payment_transactions (
    payment_intent_id, transaction_type, provider, currency_code, amount_minor,
    status, processed_at, metadata
  ) values (
    v_intent.id, 'cash_report', v_intent.provider, v_intent.currency_code,
    v_intent.amount_minor, 'requires_review', now(),
    jsonb_build_object('reported_by', p_actor_profile_id, 'note', nullif(trim(p_note), ''))
  );
  update public.payment_intents set status = 'cash_reported', version = version + 1
  where id = v_intent.id returning * into v_intent;
  update public.jobs set payment_status = 'pending', version = version + 1 where id = v_intent.job_id;
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('payment.manual_reported', 'payment_intent', v_intent.id, jsonb_build_object('job_id', v_intent.job_id));
  return v_intent;
end;
$$;

create or replace function public.post_confirmed_manual_payment(
  p_payment_intent_id uuid,
  p_actor_profile_id uuid,
  p_source text
)
returns public.payment_intents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent public.payment_intents;
  v_cash_account uuid;
  v_fee_account uuid;
  v_payable_account uuid;
  v_journal uuid := gen_random_uuid();
  v_document_number text;
begin
  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND'; end if;
  if v_intent.status in ('cash_confirmed', 'paid', 'partially_refunded', 'refunded') then return v_intent; end if;
  if v_intent.status not in ('cash_reported', 'cash_disputed') then
    raise exception using errcode = '22023', message = 'PAYMENT_NOT_CONFIRMABLE';
  end if;

  v_cash_account := public.ensure_ledger_account('payment_clearing', 'Payment settlement clearing', 'asset');
  v_fee_account := public.ensure_ledger_account('platform_fee_revenue', 'Platform fee revenue', 'revenue');
  v_payable_account := public.ensure_ledger_account(
    'professional_payable', 'Professional payable', 'liability', 'professional', v_intent.professional_id
  );
  insert into public.ledger_entries (
    journal_id, account_id, job_id, payment_intent_id, direction, amount_minor,
    entry_type, description, created_by
  ) values
    (v_journal, v_cash_account, v_intent.job_id, v_intent.id, 'debit', v_intent.amount_minor,
      case when v_intent.provider = 'cash' then 'cash_collected' else 'provider_payment_received' end,
      'Confirmed customer payment', p_actor_profile_id),
    (v_journal, v_payable_account, v_intent.job_id, v_intent.id, 'credit', v_intent.professional_amount_minor,
      'professional_payable', 'Professional share recognized', p_actor_profile_id);
  if v_intent.platform_fee_minor > 0 then
    insert into public.ledger_entries (
      journal_id, account_id, job_id, payment_intent_id, direction, amount_minor,
      entry_type, description, created_by
    ) values (
      v_journal, v_fee_account, v_intent.job_id, v_intent.id, 'credit', v_intent.platform_fee_minor,
      'platform_fee_earned', 'Configured platform fee recognized', p_actor_profile_id
    );
  end if;

  if v_intent.method_type = 'cash' and v_intent.professional_amount_minor > 0 then
    insert into public.ledger_entries (
      journal_id, account_id, job_id, payment_intent_id, direction, amount_minor,
      entry_type, description, created_by
    ) values
      (v_journal, v_payable_account, v_intent.job_id, v_intent.id, 'debit', v_intent.professional_amount_minor,
        'payout', 'Cash share settled directly to professional', p_actor_profile_id),
      (v_journal, v_cash_account, v_intent.job_id, v_intent.id, 'credit', v_intent.professional_amount_minor,
        'cash_collected', 'Direct cash settlement clearing', p_actor_profile_id);
  end if;

  insert into public.payment_transactions (
    payment_intent_id, transaction_type, provider, currency_code, amount_minor,
    status, processed_at, metadata
  ) values (
    v_intent.id, 'cash_confirmation', v_intent.provider, v_intent.currency_code,
    v_intent.amount_minor, 'succeeded', now(), jsonb_build_object('source', p_source, 'confirmed_by', p_actor_profile_id)
  );
  insert into public.professional_earnings (
    professional_id, job_id, payment_intent_id, currency_code, gross_amount_minor,
    platform_fee_minor, net_amount_minor, requires_payout, status, available_at, paid_at
  ) values (
    v_intent.professional_id, v_intent.job_id, v_intent.id, v_intent.currency_code,
    v_intent.amount_minor, v_intent.platform_fee_minor, v_intent.professional_amount_minor,
    v_intent.method_type <> 'cash',
    case when v_intent.method_type = 'cash' then 'paid' else 'available' end,
    now(), case when v_intent.method_type = 'cash' then now() else null end
  ) on conflict (payment_intent_id) do nothing;

  v_document_number := 'FM-ACK-' || to_char(now() at time zone 'Asia/Karachi', 'YYYY') || '-' ||
    lpad(nextval('public.financial_document_number_seq')::text, 8, '0');
  insert into public.transaction_documents (
    job_id, payment_intent_id, document_type, document_number, currency_code,
    subtotal_minor, fees_minor, tax_minor, total_minor, issued_to_user_id, wording
  ) values (
    v_intent.job_id, v_intent.id, 'customer_receipt', v_document_number, v_intent.currency_code,
    v_intent.amount_minor, v_intent.platform_fee_minor, 0, v_intent.amount_minor,
    v_intent.customer_id,
    case when v_intent.method_type = 'cash'
      then 'Payment acknowledgement for customer-confirmed cash payment. This is not a tax invoice.'
      else 'Payment acknowledgement for customer-confirmed manual transfer. This is not a tax invoice.'
    end
  );
  update public.payment_intents set status = 'cash_confirmed', paid_at = now(), version = version + 1
  where id = v_intent.id returning * into v_intent;
  update public.jobs set payment_status = 'paid', version = version + 1 where id = v_intent.job_id;
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('payment.confirmed', 'payment_intent', v_intent.id, jsonb_build_object('job_id', v_intent.job_id));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payment.manual_confirmed', 'payment_intent', v_intent.id,
    jsonb_build_object('source', p_source, 'journal_id', v_journal, 'amount_minor', v_intent.amount_minor));
  return v_intent;
end;
$$;

create or replace function public.confirm_manual_payment(
  p_actor_profile_id uuid,
  p_payment_intent_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns public.payment_intents
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_intent public.payment_intents; v_existing public.idempotency_keys;
begin
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'payment.confirm_manual' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_intent from public.payment_intents where id = (v_existing.response_body->>'payment_intent_id')::uuid;
    return v_intent;
  end if;
  select * into v_intent from public.payment_intents where id = p_payment_intent_id;
  if not found or v_intent.customer_id <> p_actor_profile_id then raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND'; end if;
  v_intent := public.post_confirmed_manual_payment(p_payment_intent_id, p_actor_profile_id, 'customer_confirmation');
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body, resource_type, resource_id
  ) values (
    p_actor_profile_id, 'payment.confirm_manual', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('payment_intent_id', v_intent.id), 'payment_intent', v_intent.id
  );
  return v_intent;
end;
$$;

create or replace function public.open_payment_disagreement(
  p_actor_profile_id uuid,
  p_payment_intent_id uuid,
  p_reason text
)
returns public.payment_reconciliation_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_intent public.payment_intents; v_case public.payment_reconciliation_cases;
begin
  if char_length(trim(p_reason)) < 5 then raise exception using errcode = '22023', message = 'PAYMENT_DISAGREEMENT_REASON_REQUIRED'; end if;
  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found or v_intent.customer_id <> p_actor_profile_id then raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND'; end if;
  if v_intent.status <> 'cash_reported' then raise exception using errcode = '22023', message = 'PAYMENT_NOT_DISPUTABLE'; end if;
  if exists (select 1 from public.payment_reconciliation_cases where payment_intent_id = v_intent.id and status in ('open', 'under_review')) then
    select * into v_case from public.payment_reconciliation_cases
    where payment_intent_id = v_intent.id and status in ('open', 'under_review') order by created_at desc limit 1;
    return v_case;
  end if;
  insert into public.payment_reconciliation_cases (payment_intent_id, opened_by, reason)
  values (v_intent.id, p_actor_profile_id, trim(p_reason)) returning * into v_case;
  update public.payment_intents set status = 'cash_disputed', version = version + 1 where id = v_intent.id;
  update public.jobs set payment_status = 'disputed', version = version + 1 where id = v_intent.job_id;
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('payment.disagreement_opened', 'payment_intent', v_intent.id, jsonb_build_object('case_id', v_case.id));
  return v_case;
end;
$$;

create or replace function public.reconcile_manual_payment(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_case_id uuid,
  p_resolution text,
  p_confirmed boolean,
  p_evidence_reference text
)
returns public.payment_reconciliation_cases
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_case public.payment_reconciliation_cases; v_intent public.payment_intents;
begin
  if p_actor_role not in ('support', 'admin', 'super_admin') then raise exception using errcode = '42501', message = 'STAFF_REQUIRED'; end if;
  if char_length(trim(p_resolution)) < 5 then raise exception using errcode = '22023', message = 'RECONCILIATION_RESOLUTION_REQUIRED'; end if;
  select * into v_case from public.payment_reconciliation_cases where id = p_case_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'RECONCILIATION_NOT_FOUND'; end if;
  if v_case.status not in ('open', 'under_review') then raise exception using errcode = '22023', message = 'RECONCILIATION_ALREADY_RESOLVED'; end if;
  select * into v_intent from public.payment_intents where id = v_case.payment_intent_id;
  if p_confirmed then
    perform public.post_confirmed_manual_payment(v_intent.id, p_actor_profile_id, 'staff_reconciliation');
  else
    update public.payment_intents set status = 'cash_due', version = version + 1 where id = v_intent.id;
    update public.jobs set payment_status = 'due', version = version + 1 where id = v_intent.job_id;
  end if;
  update public.payment_reconciliation_cases set
    status = 'resolved', resolution = trim(p_resolution), evidence_reference = nullif(trim(p_evidence_reference), ''),
    resolved_by = p_actor_profile_id, resolved_at = now()
  where id = v_case.id returning * into v_case;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payment.reconciled', 'payment_reconciliation_case', v_case.id,
    jsonb_build_object('payment_confirmed', p_confirmed, 'resolution', p_resolution));
  return v_case;
end;
$$;

create or replace function public.request_payment_refund(
  p_actor_profile_id uuid,
  p_payment_intent_id uuid,
  p_amount_minor bigint,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.refunds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intent public.payment_intents;
  v_refund public.refunds;
  v_existing public.idempotency_keys;
  v_reserved bigint;
begin
  if p_amount_minor <= 0 or char_length(trim(p_reason)) < 5 then raise exception using errcode = '22023', message = 'INVALID_REFUND_REQUEST'; end if;
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'refund.create' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_refund from public.refunds where id = (v_existing.response_body->>'refund_id')::uuid;
    return v_refund;
  end if;
  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found or v_intent.customer_id <> p_actor_profile_id then raise exception using errcode = 'P0002', message = 'PAYMENT_NOT_FOUND'; end if;
  if v_intent.status not in ('cash_confirmed', 'paid', 'partially_refunded') then raise exception using errcode = '22023', message = 'REFUND_NOT_AVAILABLE'; end if;
  select coalesce(sum(amount_minor), 0) into v_reserved from public.refunds
  where payment_intent_id = v_intent.id and status in ('requested', 'approved', 'processing', 'completed');
  if v_reserved + p_amount_minor > v_intent.amount_minor then raise exception using errcode = '22023', message = 'REFUND_EXCEEDS_PAYMENT'; end if;
  insert into public.refunds (
    job_id, payment_intent_id, currency_code, amount_minor, reason, provider,
    requested_by, idempotency_key
  ) values (
    v_intent.job_id, v_intent.id, v_intent.currency_code, p_amount_minor,
    trim(p_reason), v_intent.provider, p_actor_profile_id, p_idempotency_key
  ) returning * into v_refund;
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body, resource_type, resource_id
  ) values (
    p_actor_profile_id, 'refund.create', p_idempotency_key, p_request_hash, 201,
    jsonb_build_object('refund_id', v_refund.id), 'refund', v_refund.id
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('refund.requested', 'refund', v_refund.id, jsonb_build_object('payment_intent_id', v_intent.id));
  return v_refund;
end;
$$;

create or replace function public.decide_payment_refund(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_refund_id uuid,
  p_approved boolean,
  p_reason text
)
returns public.refunds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_refund public.refunds;
begin
  if p_actor_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFUND_NOT_FOUND'; end if;
  if v_refund.status <> 'requested' then raise exception using errcode = '22023', message = 'REFUND_NOT_DECIDABLE'; end if;
  update public.refunds set
    status = case when p_approved then 'approved' else 'rejected' end,
    approved_by = case when p_approved then p_actor_profile_id else null end,
    reason = reason || E'\nDecision: ' || trim(p_reason)
  where id = v_refund.id returning * into v_refund;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'refund.decided', 'refund', v_refund.id,
    jsonb_build_object('approved', p_approved, 'reason', p_reason));
  return v_refund;
end;
$$;

create or replace function public.complete_manual_refund(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_refund_id uuid,
  p_provider_reference text
)
returns public.refunds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refunds;
  v_intent public.payment_intents;
  v_completed_total bigint;
  v_fee_reversal bigint;
  v_professional_reversal bigint;
  v_fee_account uuid;
  v_payable_account uuid;
  v_clearing_account uuid;
  v_journal uuid := gen_random_uuid();
  v_document_number text;
begin
  if p_actor_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if nullif(trim(p_provider_reference), '') is null then raise exception using errcode = '22023', message = 'REFUND_EVIDENCE_REQUIRED'; end if;
  select * into v_refund from public.refunds where id = p_refund_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REFUND_NOT_FOUND'; end if;
  if v_refund.status = 'completed' then return v_refund; end if;
  if v_refund.status <> 'approved' then raise exception using errcode = '22023', message = 'REFUND_NOT_PROCESSABLE'; end if;
  select * into v_intent from public.payment_intents where id = v_refund.payment_intent_id for update;
  select coalesce(sum(amount_minor), 0) into v_completed_total from public.refunds
  where payment_intent_id = v_intent.id and status = 'completed';
  if v_completed_total + v_refund.amount_minor > v_intent.amount_minor then raise exception using errcode = '22023', message = 'REFUND_EXCEEDS_PAYMENT'; end if;

  v_fee_reversal := least(v_intent.platform_fee_minor - round(v_completed_total * v_intent.platform_fee_minor / v_intent.amount_minor::numeric)::bigint,
    round(v_refund.amount_minor * v_intent.platform_fee_minor / v_intent.amount_minor::numeric)::bigint);
  v_professional_reversal := v_refund.amount_minor - v_fee_reversal;
  v_fee_account := public.ensure_ledger_account('platform_fee_revenue', 'Platform fee revenue', 'revenue');
  v_payable_account := public.ensure_ledger_account('professional_payable', 'Professional payable', 'liability', 'professional', v_intent.professional_id);
  v_clearing_account := public.ensure_ledger_account('payment_clearing', 'Payment settlement clearing', 'asset');
  if v_fee_reversal > 0 then
    insert into public.ledger_entries (
      journal_id, account_id, job_id, payment_intent_id, refund_id, direction,
      amount_minor, entry_type, description, created_by
    ) values (
      v_journal, v_fee_account, v_intent.job_id, v_intent.id, v_refund.id, 'debit',
      v_fee_reversal, 'refund_liability', 'Platform fee reversed for refund', p_actor_profile_id
    );
  end if;
  if v_professional_reversal > 0 then
    insert into public.ledger_entries (
      journal_id, account_id, job_id, payment_intent_id, refund_id, direction,
      amount_minor, entry_type, description, created_by
    ) values (
      v_journal, v_payable_account, v_intent.job_id, v_intent.id, v_refund.id, 'debit',
      v_professional_reversal, 'refund_liability', 'Professional share reversed for refund', p_actor_profile_id
    );
  end if;
  insert into public.ledger_entries (
    journal_id, account_id, job_id, payment_intent_id, refund_id, direction,
    amount_minor, entry_type, description, created_by
  ) values (
    v_journal, v_clearing_account, v_intent.job_id, v_intent.id, v_refund.id, 'credit',
    v_refund.amount_minor, 'refund_liability', 'Manual refund settlement recorded', p_actor_profile_id
  );
  insert into public.payment_transactions (
    payment_intent_id, transaction_type, provider, provider_transaction_id,
    currency_code, amount_minor, status, processed_at, metadata
  ) values (
    v_intent.id,
    case when v_refund.amount_minor = v_intent.amount_minor then 'refund' else 'partial_refund' end,
    v_refund.provider, trim(p_provider_reference), v_refund.currency_code,
    v_refund.amount_minor, 'succeeded', now(), jsonb_build_object('refund_id', v_refund.id)
  );
  update public.professional_earnings set
    adjustment_minor = adjustment_minor - v_professional_reversal,
    net_amount_minor = net_amount_minor - v_professional_reversal,
    status = case when net_amount_minor - v_professional_reversal = 0 then 'reversed' else 'held' end,
    held_reason = 'Refund adjustment pending settlement'
  where payment_intent_id = v_intent.id;
  update public.refunds set status = 'completed', provider_reference = trim(p_provider_reference), processed_at = now()
  where id = v_refund.id returning * into v_refund;
  v_completed_total := v_completed_total + v_refund.amount_minor;
  update public.payment_intents set
    status = case when v_completed_total = amount_minor then 'refunded' else 'partially_refunded' end,
    version = version + 1
  where id = v_intent.id;
  update public.jobs set
    payment_status = case when v_completed_total = v_intent.amount_minor then 'refunded' else 'partially_refunded' end,
    version = version + 1
  where id = v_intent.job_id;
  v_document_number := 'FM-RFD-' || to_char(now() at time zone 'Asia/Karachi', 'YYYY') || '-' ||
    lpad(nextval('public.financial_document_number_seq')::text, 8, '0');
  insert into public.transaction_documents (
    job_id, payment_intent_id, document_type, document_number, currency_code,
    subtotal_minor, fees_minor, tax_minor, total_minor, issued_to_user_id, wording
  ) values (
    v_intent.job_id, v_intent.id, 'refund_receipt', v_document_number, v_refund.currency_code,
    v_refund.amount_minor, 0, 0, v_refund.amount_minor, v_intent.customer_id,
    'Manual refund acknowledgement. This records the approved refund and is not a tax invoice.'
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'refund.completed', 'refund', v_refund.id,
    jsonb_build_object('amount_minor', v_refund.amount_minor, 'journal_id', v_journal, 'provider_reference', p_provider_reference));
  return v_refund;
end;
$$;

create or replace function public.create_professional_payout(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_professional_id uuid,
  p_earning_ids uuid[],
  p_idempotency_key text,
  p_request_hash text
)
returns public.professional_payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.idempotency_keys;
  v_payout public.professional_payouts;
  v_account public.professional_payout_profiles;
  v_count integer;
  v_amount bigint;
begin
  if p_actor_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if coalesce(array_length(p_earning_ids, 1), 0) = 0 then raise exception using errcode = '22023', message = 'PAYOUT_EARNINGS_REQUIRED'; end if;
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'payout.create' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '23505', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_payout from public.professional_payouts where id = (v_existing.response_body->>'payout_id')::uuid;
    return v_payout;
  end if;
  select * into v_account from public.professional_payout_profiles
  where professional_profile_id = p_professional_id and is_verified for update;
  if not found or v_account.payout_method is null then raise exception using errcode = '22023', message = 'VERIFIED_PAYOUT_ACCOUNT_REQUIRED'; end if;
  perform 1 from public.professional_earnings
  where id = any(p_earning_ids) and professional_id = p_professional_id for update;
  select count(*), coalesce(sum(net_amount_minor), 0) into v_count, v_amount
  from public.professional_earnings
  where id = any(p_earning_ids) and professional_id = p_professional_id
    and requires_payout and status = 'available';
  if v_count <> array_length(p_earning_ids, 1) or v_amount <= 0 then
    raise exception using errcode = '22023', message = 'PAYOUT_EARNINGS_NOT_AVAILABLE';
  end if;
  insert into public.professional_payouts (
    professional_id, payout_account_id, provider, currency_code, amount_minor,
    requested_by, idempotency_key
  ) values (
    p_professional_id, v_account.professional_profile_id, 'manual', 'PKR', v_amount,
    p_actor_profile_id, p_idempotency_key
  ) returning * into v_payout;
  insert into public.payout_earning_items (payout_id, earning_id, amount_minor)
  select v_payout.id, id, net_amount_minor from public.professional_earnings where id = any(p_earning_ids);
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body, resource_type, resource_id
  ) values (
    p_actor_profile_id, 'payout.create', p_idempotency_key, p_request_hash, 201,
    jsonb_build_object('payout_id', v_payout.id), 'professional_payout', v_payout.id
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payout.draft_created', 'professional_payout', v_payout.id,
    jsonb_build_object('professional_id', p_professional_id, 'amount_minor', v_amount));
  return v_payout;
end;
$$;

create or replace function public.approve_professional_payout(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_payout_id uuid
)
returns public.professional_payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_payout public.professional_payouts;
begin
  if p_actor_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  select * into v_payout from public.professional_payouts where id = p_payout_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status <> 'draft' then raise exception using errcode = '22023', message = 'PAYOUT_NOT_APPROVABLE'; end if;
  if v_payout.requested_by = p_actor_profile_id then raise exception using errcode = '42501', message = 'PAYOUT_MAKER_CHECKER_REQUIRED'; end if;
  update public.professional_payouts set status = 'scheduled', approved_by = p_actor_profile_id, scheduled_at = now()
  where id = v_payout.id returning * into v_payout;
  update public.professional_earnings set status = 'scheduled'
  where id in (select earning_id from public.payout_earning_items where payout_id = v_payout.id) and status = 'available';
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payout.approved', 'professional_payout', v_payout.id,
    jsonb_build_object('requested_by', v_payout.requested_by, 'amount_minor', v_payout.amount_minor));
  return v_payout;
end;
$$;

create or replace function public.record_professional_payout_paid(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_payout_id uuid,
  p_provider_reference text,
  p_evidence_storage_path text
)
returns public.professional_payouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payout public.professional_payouts;
  v_payable_account uuid;
  v_clearing_account uuid;
  v_journal uuid := gen_random_uuid();
  v_document_number text;
begin
  if p_actor_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if nullif(trim(p_provider_reference), '') is null or nullif(trim(p_evidence_storage_path), '') is null then
    raise exception using errcode = '22023', message = 'PAYOUT_EVIDENCE_REQUIRED';
  end if;
  select * into v_payout from public.professional_payouts where id = p_payout_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'PAYOUT_NOT_FOUND'; end if;
  if v_payout.status = 'paid' then return v_payout; end if;
  if v_payout.status not in ('scheduled', 'processing') or v_payout.approved_by is null then
    raise exception using errcode = '22023', message = 'PAYOUT_NOT_PAYABLE';
  end if;
  v_payable_account := public.ensure_ledger_account('professional_payable', 'Professional payable', 'liability', 'professional', v_payout.professional_id);
  v_clearing_account := public.ensure_ledger_account('payment_clearing', 'Payment settlement clearing', 'asset');
  insert into public.ledger_entries (
    journal_id, account_id, payout_id, direction, amount_minor, entry_type, description, created_by
  ) values
    (v_journal, v_payable_account, v_payout.id, 'debit', v_payout.amount_minor, 'payout', 'Professional payable settled', p_actor_profile_id),
    (v_journal, v_clearing_account, v_payout.id, 'credit', v_payout.amount_minor, 'payout', 'Manual payout settlement recorded', p_actor_profile_id);
  update public.professional_payouts set
    status = 'paid', provider_reference = trim(p_provider_reference),
    evidence_storage_path = trim(p_evidence_storage_path), processed_at = now()
  where id = v_payout.id returning * into v_payout;
  update public.professional_earnings set status = 'paid', paid_at = now()
  where id in (select earning_id from public.payout_earning_items where payout_id = v_payout.id);
  v_document_number := 'FM-PAY-' || to_char(now() at time zone 'Asia/Karachi', 'YYYY') || '-' ||
    lpad(nextval('public.financial_document_number_seq')::text, 8, '0');
  insert into public.transaction_documents (
    document_type, document_number, currency_code, subtotal_minor, fees_minor,
    tax_minor, total_minor, issued_to_user_id, wording
  ) values (
    'payout_statement', v_document_number, v_payout.currency_code, v_payout.amount_minor,
    0, 0, v_payout.amount_minor, v_payout.professional_id,
    'Professional payout statement for a manually recorded settlement. This is not a tax invoice.'
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'payout.paid_recorded', 'professional_payout', v_payout.id,
    jsonb_build_object('provider_reference', p_provider_reference, 'journal_id', v_journal));
  return v_payout;
end;
$$;

create or replace function public.record_payment_webhook_event(
  p_provider text,
  p_provider_event_id text,
  p_signature_verified boolean,
  p_event_type text,
  p_payload_hash text
)
returns public.payment_webhook_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_event public.payment_webhook_events;
begin
  insert into public.payment_webhook_events (
    provider, provider_event_id, signature_verified, event_type, payload_hash,
    processing_status, processed_at, failure_reason
  ) values (
    p_provider, p_provider_event_id, p_signature_verified, p_event_type, p_payload_hash,
    case when p_signature_verified then 'processed' else 'failed' end,
    now(), case when p_signature_verified then null else 'Signature verification failed' end
  )
  on conflict (provider, provider_event_id) do update set
    payload_hash = public.payment_webhook_events.payload_hash
  returning * into v_event;
  if v_event.payload_hash <> p_payload_hash then
    raise exception using errcode = '23505', message = 'WEBHOOK_IDEMPOTENCY_CONFLICT';
  end if;
  return v_event;
end;
$$;

revoke all on function public.calculate_marketplace_fee(uuid, bigint) from public, anon, authenticated;
revoke all on function public.ensure_ledger_account(text, text, text, text, uuid, char) from public, anon, authenticated;
revoke all on function public.create_job_payment_intent(uuid, uuid, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.report_manual_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.post_confirmed_manual_payment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.confirm_manual_payment(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.open_payment_disagreement(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reconcile_manual_payment(uuid, text, uuid, text, boolean, text) from public, anon, authenticated;
revoke all on function public.request_payment_refund(uuid, uuid, bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.decide_payment_refund(uuid, text, uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.complete_manual_refund(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.create_professional_payout(uuid, text, uuid, uuid[], text, text) from public, anon, authenticated;
revoke all on function public.approve_professional_payout(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.record_professional_payout_paid(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_payment_webhook_event(text, text, boolean, text, text) from public, anon, authenticated;

grant execute on function public.calculate_marketplace_fee(uuid, bigint) to service_role;
grant execute on function public.ensure_ledger_account(text, text, text, text, uuid, char) to service_role;
grant execute on function public.create_job_payment_intent(uuid, uuid, text, text, uuid, text, text) to service_role;
grant execute on function public.report_manual_payment(uuid, uuid, text) to service_role;
grant execute on function public.post_confirmed_manual_payment(uuid, uuid, text) to service_role;
grant execute on function public.confirm_manual_payment(uuid, uuid, text, text) to service_role;
grant execute on function public.open_payment_disagreement(uuid, uuid, text) to service_role;
grant execute on function public.reconcile_manual_payment(uuid, text, uuid, text, boolean, text) to service_role;
grant execute on function public.request_payment_refund(uuid, uuid, bigint, text, text, text) to service_role;
grant execute on function public.decide_payment_refund(uuid, text, uuid, boolean, text) to service_role;
grant execute on function public.complete_manual_refund(uuid, text, uuid, text) to service_role;
grant execute on function public.create_professional_payout(uuid, text, uuid, uuid[], text, text) to service_role;
grant execute on function public.approve_professional_payout(uuid, text, uuid) to service_role;
grant execute on function public.record_professional_payout_paid(uuid, text, uuid, text, text) to service_role;
grant execute on function public.record_payment_webhook_event(text, text, boolean, text, text) to service_role;
