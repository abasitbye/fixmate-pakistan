-- Transactional commands for inspection, versioned quotations, change orders,
-- participant chat, work progress, and completion.

alter table public.jobs
  add column pause_reason text,
  add column paused_at timestamptz,
  add column completion_issue_status text not null default 'none'
    check (completion_issue_status in ('none', 'reported', 'resolved'));

create or replace function public.append_job_system_message(
  p_job_id uuid,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.job_messages
language plpgsql
security definer
set search_path = ''
as $$
declare v_message public.job_messages;
begin
  insert into public.job_messages (job_id, sender_user_id, message_type, body, metadata)
  values (p_job_id, null, 'system', left(trim(p_body), 4000), coalesce(p_metadata, '{}'::jsonb))
  returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.start_job_inspection(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer
)
returns public.job_inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_inspection public.job_inspections;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'arrived' then raise exception using errcode = '22023', message = 'INSPECTION_NOT_STARTABLE'; end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  insert into public.job_inspections (
    job_id, professional_id, started_at, status
  ) values (
    p_job_id, p_actor_profile_id, now(), 'in_progress'
  )
  on conflict (job_id) do update set
    started_at = coalesce(public.job_inspections.started_at, now()),
    status = 'in_progress',
    version = public.job_inspections.version + 1
  where public.job_inspections.status = 'pending'
  returning * into v_inspection;
  if not found then raise exception using errcode = '22023', message = 'INSPECTION_NOT_STARTABLE'; end if;
  update public.jobs set
    status = 'inspecting', work_status = 'inspection', inspection_started_at = now(), version = version + 1
  where id = p_job_id;
  perform public.append_job_system_message(p_job_id, 'The professional started the inspection.', jsonb_build_object('inspectionId', v_inspection.id));
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('job.inspection_started', 'job', p_job_id, jsonb_build_object('inspectionId', v_inspection.id));
  return v_inspection;
end;
$$;

create or replace function public.complete_job_inspection(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_inspection_id uuid,
  p_expected_version integer,
  p_findings text,
  p_recommended_work text,
  p_safety_notes text
)
returns public.job_inspections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_inspection public.job_inspections;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'inspecting' then raise exception using errcode = '22023', message = 'INSPECTION_NOT_COMPLETABLE'; end if;
  select * into v_inspection from public.job_inspections
  where id = p_inspection_id and job_id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found or v_inspection.status <> 'in_progress' then raise exception using errcode = '22023', message = 'INSPECTION_NOT_COMPLETABLE'; end if;
  if v_inspection.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if char_length(trim(p_findings)) < 10 or char_length(trim(p_recommended_work)) < 10 then
    raise exception using errcode = '22023', message = 'INSPECTION_DETAILS_REQUIRED';
  end if;
  update public.job_inspections set
    findings = trim(p_findings),
    recommended_work = trim(p_recommended_work),
    safety_notes = nullif(trim(p_safety_notes), ''),
    status = 'completed',
    completed_at = now(),
    version = version + 1
  where id = p_inspection_id returning * into v_inspection;
  update public.jobs set
    status = 'awaiting_quotation', work_status = 'awaiting_approval', version = version + 1
  where id = p_job_id;
  perform public.append_job_system_message(p_job_id, 'The inspection was completed. A quotation is being prepared.', jsonb_build_object('inspectionId', p_inspection_id));
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.customer_id, 'in_app', 'job.inspection_completed', 'Inspection completed',
    'The professional completed the inspection and will submit a quotation.',
    jsonb_build_object('jobId', p_job_id)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('job.inspection_completed', 'job', p_job_id, jsonb_build_object('inspectionId', p_inspection_id));
  return v_inspection;
end;
$$;

create or replace function public.save_job_quotation(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_quotation_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns public.job_quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_quotation public.job_quotations;
  v_item jsonb;
  v_item_type text;
  v_quantity numeric;
  v_unit_price bigint;
  v_amount bigint;
  v_labor bigint := 0;
  v_materials bigint := 0;
  v_other bigint := 0;
  v_discount bigint := 0;
  v_total bigint := 0;
  v_version_number integer;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status not in ('arrived', 'inspecting', 'awaiting_quotation') then
    raise exception using errcode = '22023', message = 'QUOTATION_NOT_EDITABLE';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') = 0 then
    raise exception using errcode = '22023', message = 'QUOTATION_ITEMS_REQUIRED';
  end if;
  for v_item in select value from jsonb_array_elements(p_payload->'items') loop
    v_item_type := v_item->>'item_type';
    if v_item_type not in ('labor', 'material', 'other', 'discount') then
      raise exception using errcode = '22023', message = 'INVALID_QUOTATION_ITEM';
    end if;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item->>'unit_price_minor', '')::bigint, 0);
    if v_quantity <= 0 or v_unit_price < 0 or char_length(trim(v_item->>'description')) < 2 then
      raise exception using errcode = '22023', message = 'INVALID_QUOTATION_ITEM';
    end if;
    v_amount := round(v_quantity * v_unit_price)::bigint;
    case v_item_type
      when 'labor' then v_labor := v_labor + v_amount;
      when 'material' then v_materials := v_materials + v_amount;
      when 'other' then v_other := v_other + v_amount;
      when 'discount' then v_discount := v_discount + v_amount;
    end case;
  end loop;
  v_total := greatest(0, v_labor + v_materials + v_other - v_discount);
  if v_total <= 0 then raise exception using errcode = '22023', message = 'INVALID_QUOTATION_TOTAL'; end if;
  if coalesce(nullif(p_payload->>'deposit_required_minor', '')::bigint, 0) > v_total then
    raise exception using errcode = '22023', message = 'INVALID_QUOTATION_DEPOSIT';
  end if;

  if p_quotation_id is null then
    select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.job_quotations where job_id = p_job_id;
    insert into public.job_quotations (
      job_id, professional_id, customer_id, version_number, currency_code,
      labor_subtotal_minor, materials_subtotal_minor, other_subtotal_minor,
      discount_minor, tax_minor, platform_fee_minor, total_minor,
      deposit_required_minor, estimated_duration_minutes, warranty_days,
      terms, exclusions, notes, valid_until
    ) values (
      p_job_id, p_actor_profile_id, v_job.customer_id, v_version_number, 'PKR',
      v_labor, v_materials, v_other, v_discount, 0, 0, v_total,
      coalesce(nullif(p_payload->>'deposit_required_minor', '')::bigint, 0),
      nullif(p_payload->>'estimated_duration_minutes', '')::integer,
      coalesce(nullif(p_payload->>'warranty_days', '')::integer, 0),
      nullif(trim(p_payload->>'terms'), ''),
      nullif(trim(p_payload->>'exclusions'), ''),
      nullif(trim(p_payload->>'notes'), ''),
      nullif(p_payload->>'valid_until', '')::timestamptz
    ) returning * into v_quotation;
  else
    select * into v_quotation from public.job_quotations
    where id = p_quotation_id and job_id = p_job_id and professional_id = p_actor_profile_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'QUOTATION_NOT_FOUND'; end if;
    if v_quotation.status <> 'draft' or v_quotation.version <> p_expected_version then
      if v_quotation.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
      raise exception using errcode = '22023', message = 'QUOTATION_NOT_EDITABLE';
    end if;
    update public.job_quotations set
      labor_subtotal_minor = v_labor,
      materials_subtotal_minor = v_materials,
      other_subtotal_minor = v_other,
      discount_minor = v_discount,
      total_minor = v_total,
      deposit_required_minor = coalesce(nullif(p_payload->>'deposit_required_minor', '')::bigint, 0),
      estimated_duration_minutes = nullif(p_payload->>'estimated_duration_minutes', '')::integer,
      warranty_days = coalesce(nullif(p_payload->>'warranty_days', '')::integer, 0),
      terms = nullif(trim(p_payload->>'terms'), ''),
      exclusions = nullif(trim(p_payload->>'exclusions'), ''),
      notes = nullif(trim(p_payload->>'notes'), ''),
      valid_until = nullif(p_payload->>'valid_until', '')::timestamptz,
      version = version + 1
    where id = p_quotation_id returning * into v_quotation;
    delete from public.job_quotation_items where quotation_id = p_quotation_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_payload->'items') with ordinality as rows(value, ordinal) loop
    v_item_type := v_item->>'item_type';
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item->>'unit_price_minor', '')::bigint, 0);
    v_amount := round(v_quantity * v_unit_price)::bigint;
    insert into public.job_quotation_items (
      quotation_id, item_type, description, quantity, unit, unit_price_minor,
      amount_minor, material_source, display_order
    ) values (
      v_quotation.id, v_item_type, trim(v_item->>'description'), v_quantity,
      coalesce(nullif(trim(v_item->>'unit'), ''), 'item'), v_unit_price,
      v_amount, case when v_item_type = 'material' then coalesce(nullif(v_item->>'material_source', ''), 'professional') else null end,
      coalesce(nullif(v_item->>'display_order', '')::integer, 0)
    );
  end loop;
  return v_quotation;
end;
$$;

create or replace function public.submit_job_quotation(
  p_actor_profile_id uuid,
  p_quotation_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns public.job_quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_quotation public.job_quotations;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'quotation.submit' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_quotation from public.job_quotations where id = v_existing.resource_id;
    return v_quotation;
  end if;
  select * into v_quotation from public.job_quotations
  where id = p_quotation_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'QUOTATION_NOT_FOUND'; end if;
  if v_quotation.status <> 'draft' then raise exception using errcode = '22023', message = 'QUOTATION_NOT_SUBMITTABLE'; end if;
  if v_quotation.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if v_quotation.valid_until is null or v_quotation.valid_until <= now() then
    raise exception using errcode = '22023', message = 'QUOTATION_VALIDITY_REQUIRED';
  end if;
  update public.job_quotations set
    status = 'submitted', submitted_at = now(), version = version + 1
  where id = p_quotation_id returning * into v_quotation;
  update public.job_quotations set
    status = 'superseded', superseded_at = now(), version = version + 1
  where job_id = v_quotation.job_id and id <> p_quotation_id and status = 'submitted';
  update public.jobs set
    status = 'awaiting_approval', work_status = 'awaiting_approval', version = version + 1
  where id = v_quotation.job_id and professional_id = p_actor_profile_id;
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'quotation.submit', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('quotationId', v_quotation.id), 'quotation', v_quotation.id, now() + interval '24 hours'
  );
  perform public.append_job_system_message(v_quotation.job_id, 'A quotation was submitted for customer review.', jsonb_build_object('quotationId', v_quotation.id, 'versionNumber', v_quotation.version_number));
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_quotation.customer_id, 'in_app', 'quotation.submitted', 'Quotation ready',
    'Review the itemized scope, price, schedule, warranty, terms, and exclusions.',
    jsonb_build_object('jobId', v_quotation.job_id, 'quotationId', v_quotation.id, 'deepLink', '/customer/jobs/' || v_quotation.job_id::text || '/quotation')
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('quotation.submitted', 'quotation', v_quotation.id, jsonb_build_object('jobId', v_quotation.job_id));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'quotation.submit', 'quotation', v_quotation.id::text, jsonb_build_object('totalMinor', v_quotation.total_minor, 'versionNumber', v_quotation.version_number));
  return v_quotation;
end;
$$;

create or replace function public.decide_job_quotation(
  p_actor_profile_id uuid,
  p_quotation_id uuid,
  p_expected_version integer,
  p_decision text,
  p_reason text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.job_quotations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_quotation public.job_quotations;
  v_item public.job_quotation_items;
begin
  if p_decision not in ('approved', 'rejected', 'revision_requested', 'clarification_requested') then
    raise exception using errcode = '22023', message = 'INVALID_QUOTATION_DECISION';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'quotation.decision' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_quotation from public.job_quotations where id = v_existing.resource_id;
    return v_quotation;
  end if;
  select * into v_quotation from public.job_quotations
  where id = p_quotation_id and customer_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'QUOTATION_NOT_FOUND'; end if;
  if v_quotation.status <> 'submitted' then raise exception using errcode = '22023', message = 'QUOTATION_NOT_DECIDABLE'; end if;
  if v_quotation.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if v_quotation.valid_until <= now() then
    update public.job_quotations set status = 'expired', version = version + 1 where id = p_quotation_id;
    raise exception using errcode = '22023', message = 'QUOTATION_EXPIRED';
  end if;
  if p_decision <> 'approved' and char_length(trim(p_reason)) < 3 then
    raise exception using errcode = '22023', message = 'DECISION_REASON_REQUIRED';
  end if;
  insert into public.quotation_decisions (quotation_id, customer_id, decision, reason)
  values (p_quotation_id, p_actor_profile_id, p_decision, nullif(trim(p_reason), ''));
  if p_decision = 'approved' then
    update public.job_quotations set status = 'approved', approved_at = now(), version = version + 1
    where id = p_quotation_id returning * into v_quotation;
    update public.job_quotations set status = 'superseded', superseded_at = now(), version = version + 1
    where job_id = v_quotation.job_id and id <> p_quotation_id and status in ('draft', 'submitted');
    update public.jobs set status = 'approved', work_status = 'awaiting_approval', version = version + 1
    where id = v_quotation.job_id;
    for v_item in select * from public.job_quotation_items
      where quotation_id = p_quotation_id and item_type = 'material'
    loop
      insert into public.job_material_items (
        job_id, quotation_id, description, quantity, unit, material_source,
        estimated_unit_cost_minor, estimated_amount_minor, approved_by_customer, approved_at,
        purchase_status
      ) values (
        v_quotation.job_id, p_quotation_id, v_item.description, v_item.quantity, v_item.unit,
        coalesce(v_item.material_source, 'professional'), v_item.unit_price_minor, v_item.amount_minor,
        true, now(), case when v_item.material_source = 'customer' then 'customer_supplying' else 'planned' end
      );
    end loop;
  elsif p_decision = 'rejected' then
    update public.job_quotations set status = 'rejected', rejected_at = now(), version = version + 1
    where id = p_quotation_id returning * into v_quotation;
    update public.jobs set status = 'awaiting_quotation', version = version + 1 where id = v_quotation.job_id;
  elsif p_decision = 'revision_requested' then
    update public.job_quotations set status = 'revised', version = version + 1
    where id = p_quotation_id returning * into v_quotation;
    update public.jobs set status = 'awaiting_quotation', version = version + 1 where id = v_quotation.job_id;
  end if;
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'quotation.decision', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('quotationId', v_quotation.id, 'decision', p_decision),
    'quotation', v_quotation.id, now() + interval '24 hours'
  );
  perform public.append_job_system_message(
    v_quotation.job_id,
    case p_decision
      when 'approved' then 'The customer approved the quotation.'
      when 'rejected' then 'The customer rejected the quotation.'
      when 'revision_requested' then 'The customer requested a quotation revision.'
      else 'The customer requested clarification on the quotation.'
    end,
    jsonb_build_object('quotationId', p_quotation_id, 'decision', p_decision)
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_quotation.professional_id, 'in_app', 'quotation.' || p_decision,
    case p_decision
      when 'approved' then 'Quotation approved'
      when 'rejected' then 'Quotation declined'
      when 'revision_requested' then 'Quotation revision requested'
      else 'Quotation clarification requested'
    end,
    coalesce(nullif(trim(p_reason), ''), 'Open the job to review the customer decision.'),
    jsonb_build_object('jobId', v_quotation.job_id, 'quotationId', p_quotation_id)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('quotation.' || p_decision, 'quotation', p_quotation_id, jsonb_build_object('jobId', v_quotation.job_id));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'quotation.' || p_decision, 'quotation', p_quotation_id::text, jsonb_build_object('reason', nullif(trim(p_reason), '')));
  return v_quotation;
end;
$$;

create or replace function public.save_job_change_order(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_change_order_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns public.job_change_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_quotation public.job_quotations;
  v_change public.job_change_orders;
  v_labor bigint := coalesce(nullif(p_payload->>'labor_change_minor', '')::bigint, 0);
  v_material bigint := coalesce(nullif(p_payload->>'material_change_minor', '')::bigint, 0);
  v_other bigint := coalesce(nullif(p_payload->>'other_change_minor', '')::bigint, 0);
begin
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status not in ('approved', 'in_progress', 'paused') then
    raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_EDITABLE';
  end if;
  select * into v_quotation from public.job_quotations
  where job_id = p_job_id and status = 'approved' order by version_number desc limit 1;
  if not found then raise exception using errcode = '22023', message = 'APPROVED_QUOTATION_REQUIRED'; end if;
  if v_labor + v_material + v_other = 0 then raise exception using errcode = '22023', message = 'INVALID_CHANGE_ORDER_TOTAL'; end if;
  if char_length(trim(p_payload->>'reason')) < 3 or char_length(trim(p_payload->>'description')) < 3 then
    raise exception using errcode = '22023', message = 'CHANGE_ORDER_DETAILS_REQUIRED';
  end if;
  if p_change_order_id is null then
    insert into public.job_change_orders (
      job_id, quotation_id, requested_by, reason, description, evidence_summary,
      labor_change_minor, material_change_minor, other_change_minor, total_change_minor,
      schedule_change_minutes, emergency_safety_exception, emergency_justification
    ) values (
      p_job_id, v_quotation.id, p_actor_profile_id, trim(p_payload->>'reason'),
      trim(p_payload->>'description'), nullif(trim(p_payload->>'evidence_summary'), ''),
      v_labor, v_material, v_other, v_labor + v_material + v_other,
      coalesce(nullif(p_payload->>'schedule_change_minutes', '')::integer, 0),
      coalesce((p_payload->>'emergency_safety_exception')::boolean, false),
      nullif(trim(p_payload->>'emergency_justification'), '')
    ) returning * into v_change;
  else
    select * into v_change from public.job_change_orders
    where id = p_change_order_id and job_id = p_job_id and requested_by = p_actor_profile_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'CHANGE_ORDER_NOT_FOUND'; end if;
    if v_change.status <> 'draft' then raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_EDITABLE'; end if;
    if v_change.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
    update public.job_change_orders set
      reason = trim(p_payload->>'reason'),
      description = trim(p_payload->>'description'),
      evidence_summary = nullif(trim(p_payload->>'evidence_summary'), ''),
      labor_change_minor = v_labor,
      material_change_minor = v_material,
      other_change_minor = v_other,
      total_change_minor = v_labor + v_material + v_other,
      schedule_change_minutes = coalesce(nullif(p_payload->>'schedule_change_minutes', '')::integer, 0),
      emergency_safety_exception = coalesce((p_payload->>'emergency_safety_exception')::boolean, false),
      emergency_justification = nullif(trim(p_payload->>'emergency_justification'), ''),
      version = version + 1
    where id = p_change_order_id returning * into v_change;
  end if;
  return v_change;
end;
$$;

create or replace function public.submit_job_change_order(
  p_actor_profile_id uuid,
  p_change_order_id uuid,
  p_expected_version integer
)
returns public.job_change_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change public.job_change_orders;
  v_job public.jobs;
begin
  select * into v_change from public.job_change_orders
  where id = p_change_order_id and requested_by = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CHANGE_ORDER_NOT_FOUND'; end if;
  if v_change.status <> 'draft' then raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_SUBMITTABLE'; end if;
  if v_change.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  select * into v_job from public.jobs where id = v_change.job_id for update;
  if v_job.status not in ('approved', 'in_progress', 'paused') then raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_SUBMITTABLE'; end if;
  update public.job_change_orders set status = 'submitted', submitted_at = now(), version = version + 1
  where id = p_change_order_id returning * into v_change;
  if v_job.status = 'in_progress' and not v_change.emergency_safety_exception then
    update public.jobs set
      status = 'paused', work_status = 'paused', pause_reason = 'Additional approval needed',
      paused_at = now(), version = version + 1
    where id = v_job.id;
  end if;
  perform public.append_job_system_message(v_change.job_id, 'A change order was submitted for customer approval.', jsonb_build_object('changeOrderId', v_change.id));
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.customer_id, 'in_app', 'change_order.submitted', 'Change order ready',
    'Review the scope, price change, schedule effect, and evidence before work continues.',
    jsonb_build_object('jobId', v_job.id, 'changeOrderId', v_change.id)
  );
  return v_change;
end;
$$;

create or replace function public.decide_job_change_order(
  p_actor_profile_id uuid,
  p_change_order_id uuid,
  p_decision text,
  p_reason text
)
returns public.job_change_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_change public.job_change_orders;
  v_job public.jobs;
begin
  if p_decision not in ('approved', 'rejected') then raise exception using errcode = '22023', message = 'INVALID_CHANGE_ORDER_DECISION'; end if;
  select c.* into v_change
  from public.job_change_orders c join public.jobs j on j.id = c.job_id
  where c.id = p_change_order_id and j.customer_id = p_actor_profile_id for update of c;
  if not found then raise exception using errcode = 'P0002', message = 'CHANGE_ORDER_NOT_FOUND'; end if;
  if v_change.status <> 'submitted' then raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_DECIDABLE'; end if;
  if p_decision = 'rejected' and char_length(trim(p_reason)) < 3 then raise exception using errcode = '22023', message = 'DECISION_REASON_REQUIRED'; end if;
  update public.job_change_orders set
    status = p_decision,
    approved_at = case when p_decision = 'approved' then now() else null end,
    rejected_at = case when p_decision = 'rejected' then now() else null end,
    version = version + 1
  where id = p_change_order_id returning * into v_change;
  select * into v_job from public.jobs where id = v_change.job_id;
  perform public.append_job_system_message(
    v_change.job_id,
    case when p_decision = 'approved' then 'The customer approved the change order.' else 'The customer rejected the change order.' end,
    jsonb_build_object('changeOrderId', v_change.id, 'decision', p_decision, 'reason', nullif(trim(p_reason), ''))
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.professional_id, 'in_app', 'change_order.' || p_decision,
    case when p_decision = 'approved' then 'Change order approved' else 'Change order declined' end,
    coalesce(nullif(trim(p_reason), ''), 'Open the job to review the decision.'),
    jsonb_build_object('jobId', v_job.id, 'changeOrderId', v_change.id)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'change_order.' || p_decision, 'change_order', v_change.id::text, jsonb_build_object('totalChangeMinor', v_change.total_change_minor, 'reason', nullif(trim(p_reason), '')));
  return v_change;
end;
$$;

create or replace function public.withdraw_job_change_order(
  p_actor_profile_id uuid,
  p_change_order_id uuid,
  p_expected_version integer
)
returns public.job_change_orders
language plpgsql
security definer
set search_path = ''
as $$
declare v_change public.job_change_orders;
begin
  select * into v_change from public.job_change_orders
  where id = p_change_order_id and requested_by = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CHANGE_ORDER_NOT_FOUND'; end if;
  if v_change.status not in ('draft', 'submitted') then raise exception using errcode = '22023', message = 'CHANGE_ORDER_NOT_WITHDRAWABLE'; end if;
  if v_change.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  update public.job_change_orders set status = 'withdrawn', withdrawn_at = now(), version = version + 1
  where id = p_change_order_id returning * into v_change;
  perform public.append_job_system_message(v_change.job_id, 'The professional withdrew a change order.', jsonb_build_object('changeOrderId', v_change.id));
  return v_change;
end;
$$;

create or replace function public.send_job_message(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_job_id uuid,
  p_body text,
  p_reply_to_message_id uuid
)
returns public.job_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_message public.job_messages;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if not (
    v_job.customer_id = p_actor_profile_id
    or v_job.professional_id = p_actor_profile_id
    or p_actor_role in ('support', 'admin', 'super_admin')
  ) then raise exception using errcode = '42501', message = 'JOB_MESSAGE_FORBIDDEN'; end if;
  if char_length(trim(p_body)) < 1 or char_length(trim(p_body)) > 4000 then
    raise exception using errcode = '22023', message = 'INVALID_MESSAGE';
  end if;
  if p_reply_to_message_id is not null and not exists (
    select 1 from public.job_messages where id = p_reply_to_message_id and job_id = p_job_id
  ) then raise exception using errcode = '22023', message = 'INVALID_REPLY_TARGET'; end if;
  insert into public.job_messages (job_id, sender_user_id, message_type, body, reply_to_message_id)
  values (p_job_id, p_actor_profile_id, 'text', trim(p_body), p_reply_to_message_id)
  returning * into v_message;
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    case when p_actor_profile_id = v_job.customer_id then v_job.professional_id else v_job.customer_id end,
    'in_app', 'job.message', 'New job message', 'Open the job conversation to read the new message.',
    jsonb_build_object('jobId', p_job_id, 'messageId', v_message.id)
  );
  return v_message;
end;
$$;

create or replace function public.mark_job_message_read(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_message_id uuid
)
returns public.job_message_reads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_read public.job_message_reads;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if not found or not (v_job.customer_id = p_actor_profile_id or v_job.professional_id = p_actor_profile_id) then
    raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND';
  end if;
  if not exists (select 1 from public.job_messages where id = p_message_id and job_id = p_job_id) then
    raise exception using errcode = 'P0002', message = 'MESSAGE_NOT_FOUND';
  end if;
  insert into public.job_message_reads (message_id, user_id, read_at)
  values (p_message_id, p_actor_profile_id, now())
  on conflict (message_id, user_id) do update set read_at = excluded.read_at
  returning * into v_read;
  return v_read;
end;
$$;

create or replace function public.start_job_work(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.jobs;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'approved' or not exists (
    select 1 from public.job_quotations where job_id = p_job_id and status = 'approved'
  ) then raise exception using errcode = '22023', message = 'WORK_NOT_STARTABLE'; end if;
  if exists (select 1 from public.job_change_orders where job_id = p_job_id and status = 'submitted') then
    raise exception using errcode = '22023', message = 'CHANGE_ORDER_APPROVAL_PENDING';
  end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  update public.jobs set
    status = 'in_progress', work_status = 'in_progress',
    work_started_at = coalesce(work_started_at, now()), pause_reason = null, paused_at = null,
    version = version + 1
  where id = p_job_id returning * into v_job;
  perform public.append_job_system_message(p_job_id, 'Approved work started.', '{}'::jsonb);
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (v_job.customer_id, 'in_app', 'job.work_started', 'Work started', 'The professional started the approved work.', jsonb_build_object('jobId', p_job_id));
  return v_job;
end;
$$;

create or replace function public.pause_job_work(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.jobs;
begin
  if trim(p_reason) not in ('Waiting for material', 'Customer unavailable', 'Safety issue', 'Additional approval needed', 'Weather', 'Access issue')
    and char_length(trim(p_reason)) < 10 then
    raise exception using errcode = '22023', message = 'PAUSE_REASON_REQUIRED';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'in_progress' then raise exception using errcode = '22023', message = 'WORK_NOT_PAUSABLE'; end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  update public.jobs set
    status = 'paused', work_status = 'paused', pause_reason = trim(p_reason), paused_at = now(), version = version + 1
  where id = p_job_id returning * into v_job;
  perform public.append_job_system_message(p_job_id, 'Work was paused: ' || trim(p_reason), jsonb_build_object('reason', trim(p_reason)));
  return v_job;
end;
$$;

create or replace function public.resume_job_work(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.jobs;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'paused' then raise exception using errcode = '22023', message = 'WORK_NOT_RESUMABLE'; end if;
  if exists (select 1 from public.job_change_orders where job_id = p_job_id and status = 'submitted') then
    raise exception using errcode = '22023', message = 'CHANGE_ORDER_APPROVAL_PENDING';
  end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  update public.jobs set
    status = 'in_progress', work_status = 'in_progress', pause_reason = null, paused_at = null, version = version + 1
  where id = p_job_id returning * into v_job;
  perform public.append_job_system_message(p_job_id, 'Work resumed.', '{}'::jsonb);
  return v_job;
end;
$$;

create or replace function public.submit_job_completion(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer,
  p_summary text,
  p_outstanding_notes text
)
returns public.job_completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_quotation public.job_quotations;
  v_change_total bigint := 0;
  v_completion public.job_completions;
begin
  select * into v_job from public.jobs where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'in_progress' then raise exception using errcode = '22023', message = 'COMPLETION_NOT_SUBMITTABLE'; end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if char_length(trim(p_summary)) < 10 then raise exception using errcode = '22023', message = 'COMPLETION_SUMMARY_REQUIRED'; end if;
  if not exists (
    select 1 from public.job_media where job_id = p_job_id and media_stage = 'after_work' and deleted_at is null
  ) then raise exception using errcode = '22023', message = 'FINAL_EVIDENCE_REQUIRED'; end if;
  if exists (select 1 from public.job_change_orders where job_id = p_job_id and status = 'submitted') then
    raise exception using errcode = '22023', message = 'CHANGE_ORDER_APPROVAL_PENDING';
  end if;
  select * into v_quotation from public.job_quotations
  where job_id = p_job_id and status = 'approved' order by version_number desc limit 1;
  if not found then raise exception using errcode = '22023', message = 'APPROVED_QUOTATION_REQUIRED'; end if;
  select coalesce(sum(total_change_minor), 0) into v_change_total
  from public.job_change_orders where job_id = p_job_id and status = 'approved';
  insert into public.job_completions (
    job_id, submitted_by_professional_id, professional_summary, final_price_minor,
    warranty_days, outstanding_notes
  ) values (
    p_job_id, p_actor_profile_id, trim(p_summary), greatest(0, v_quotation.total_minor + v_change_total),
    v_quotation.warranty_days, nullif(trim(p_outstanding_notes), '')
  )
  on conflict (job_id) do update set
    professional_summary = excluded.professional_summary,
    final_price_minor = excluded.final_price_minor,
    warranty_days = excluded.warranty_days,
    outstanding_notes = excluded.outstanding_notes,
    submitted_at = now(),
    customer_decision = 'pending',
    version = public.job_completions.version + 1
  where public.job_completions.customer_decision = 'issue_reported'
  returning * into v_completion;
  if not found then raise exception using errcode = '22023', message = 'COMPLETION_NOT_SUBMITTABLE'; end if;
  update public.jobs set
    status = 'completion_submitted', work_status = 'completed',
    completion_submitted_at = now(), completion_issue_status = 'none', version = version + 1
  where id = p_job_id;
  perform public.append_job_system_message(p_job_id, 'The professional submitted completion for customer review.', jsonb_build_object('completionId', v_completion.id));
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.customer_id, 'in_app', 'job.completion_submitted', 'Completion ready for review',
    'Review the work summary, final evidence, price, and warranty before confirming.',
    jsonb_build_object('jobId', p_job_id, 'completionId', v_completion.id)
  );
  return v_completion;
end;
$$;

create or replace function public.decide_job_completion(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_decision text,
  p_notes text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.job_completions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_job public.jobs;
  v_completion public.job_completions;
begin
  if p_decision not in ('confirmed', 'issue_reported') then raise exception using errcode = '22023', message = 'INVALID_COMPLETION_DECISION'; end if;
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'completion.decision' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_completion from public.job_completions where id = v_existing.resource_id;
    return v_completion;
  end if;
  select * into v_job from public.jobs where id = p_job_id and customer_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'completion_submitted' then raise exception using errcode = '22023', message = 'COMPLETION_NOT_DECIDABLE'; end if;
  select * into v_completion from public.job_completions where job_id = p_job_id for update;
  if not found or v_completion.customer_decision <> 'pending' then raise exception using errcode = '22023', message = 'COMPLETION_NOT_DECIDABLE'; end if;
  if p_decision = 'issue_reported' and char_length(trim(p_notes)) < 10 then
    raise exception using errcode = '22023', message = 'COMPLETION_ISSUE_DETAILS_REQUIRED';
  end if;
  if p_decision = 'confirmed' then
    update public.job_completions set
      customer_decision = 'confirmed', customer_notes = nullif(trim(p_notes), ''),
      confirmed_at = now(), version = version + 1
    where id = v_completion.id returning * into v_completion;
    update public.jobs set
      status = 'completed', payment_status = 'due', customer_completed_at = now(), version = version + 1
    where id = p_job_id;
    update public.bookings set status = 'completed', version = version + 1 where id = v_job.booking_id;
  else
    update public.job_completions set
      customer_decision = 'issue_reported', customer_notes = trim(p_notes),
      rejected_at = now(), rejection_reason = trim(p_notes), version = version + 1
    where id = v_completion.id returning * into v_completion;
    update public.jobs set
      status = 'in_progress', work_status = 'in_progress',
      completion_issue_status = 'reported', version = version + 1
    where id = p_job_id;
  end if;
  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'completion.decision', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('completionId', v_completion.id, 'decision', p_decision),
    'completion', v_completion.id, now() + interval '24 hours'
  );
  perform public.append_job_system_message(
    p_job_id,
    case when p_decision = 'confirmed' then 'The customer confirmed completion.' else 'The customer reported an issue with completion.' end,
    jsonb_build_object('completionId', v_completion.id, 'decision', p_decision)
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.professional_id, 'in_app', 'job.completion_' || p_decision,
    case when p_decision = 'confirmed' then 'Completion confirmed' else 'Completion issue reported' end,
    coalesce(nullif(trim(p_notes), ''), 'Open the job to review the customer response.'),
    jsonb_build_object('jobId', p_job_id, 'completionId', v_completion.id)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('job.completion_' || p_decision, 'job', p_job_id, jsonb_build_object('completionId', v_completion.id));
  return v_completion;
end;
$$;

revoke all on function public.append_job_system_message(uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.start_job_inspection(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.complete_job_inspection(uuid,uuid,uuid,integer,text,text,text) from public, anon, authenticated;
revoke all on function public.save_job_quotation(uuid,uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.submit_job_quotation(uuid,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.decide_job_quotation(uuid,uuid,integer,text,text,text,text) from public, anon, authenticated;
revoke all on function public.save_job_change_order(uuid,uuid,uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.submit_job_change_order(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.decide_job_change_order(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.withdraw_job_change_order(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.send_job_message(uuid,text,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.mark_job_message_read(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.start_job_work(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.pause_job_work(uuid,uuid,integer,text) from public, anon, authenticated;
revoke all on function public.resume_job_work(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.submit_job_completion(uuid,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.decide_job_completion(uuid,uuid,text,text,text,text) from public, anon, authenticated;

grant execute on function public.append_job_system_message(uuid,text,jsonb) to service_role;
grant execute on function public.start_job_inspection(uuid,uuid,integer) to service_role;
grant execute on function public.complete_job_inspection(uuid,uuid,uuid,integer,text,text,text) to service_role;
grant execute on function public.save_job_quotation(uuid,uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.submit_job_quotation(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.decide_job_quotation(uuid,uuid,integer,text,text,text,text) to service_role;
grant execute on function public.save_job_change_order(uuid,uuid,uuid,integer,jsonb) to service_role;
grant execute on function public.submit_job_change_order(uuid,uuid,integer) to service_role;
grant execute on function public.decide_job_change_order(uuid,uuid,text,text) to service_role;
grant execute on function public.withdraw_job_change_order(uuid,uuid,integer) to service_role;
grant execute on function public.send_job_message(uuid,text,uuid,text,uuid) to service_role;
grant execute on function public.mark_job_message_read(uuid,uuid,uuid) to service_role;
grant execute on function public.start_job_work(uuid,uuid,integer) to service_role;
grant execute on function public.pause_job_work(uuid,uuid,integer,text) to service_role;
grant execute on function public.resume_job_work(uuid,uuid,integer) to service_role;
grant execute on function public.submit_job_completion(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.decide_job_completion(uuid,uuid,text,text,text,text) to service_role;
