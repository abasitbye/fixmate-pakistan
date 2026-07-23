-- FixMate Pakistan Phase 2: operations, abuse-review and scheduled
-- lifecycle hardening. All additions are forward-only.

create table public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  alert_code text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null check (char_length(title) between 3 and 160),
  summary_safe text not null check (char_length(summary_safe) between 3 and 1000),
  entity_type text,
  entity_id text,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid references public.user_profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.user_profiles(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_risk_signals (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  profile_id uuid not null references public.user_profiles(id) on delete restrict,
  signal_type text not null check (signal_type in (
    'duplicate_account', 'repeated_cancellation', 'repeated_no_show', 'offer_spam',
    'off_platform_solicitation', 'review_manipulation', 'payment_disagreement',
    'suspicious_refund', 'identity_mismatch', 'unsafe_communication'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  evidence_summary_safe text not null check (char_length(evidence_summary_safe) between 3 and 1000),
  reference_type text,
  reference_id text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'dismissed', 'confirmed', 'appealed', 'closed')),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text check (review_note is null or char_length(review_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  target_profile_id uuid references public.user_profiles(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  category text not null check (category in (
    'off_platform_solicitation', 'review_manipulation', 'identity_mismatch',
    'unsafe_communication', 'harassment', 'spam', 'other'
  )),
  description text not null check (char_length(description) between 10 and 4000),
  status text not null default 'submitted' check (status in ('submitted', 'triaged', 'investigating', 'resolved', 'dismissed')),
  assigned_to uuid references public.user_profiles(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.background_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_code text not null,
  trigger_source text not null,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped_locked')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  result_safe jsonb not null default '{}'::jsonb,
  error_safe text,
  created_at timestamptz not null default now()
);

create table public.data_retention_policies (
  data_class text primary key,
  retention_days integer check (retention_days is null or retention_days > 0),
  disposition text not null check (disposition in ('delete', 'anonymize', 'archive', 'legal_hold_review')),
  rationale text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.data_retention_policies(data_class, retention_days, disposition, rationale)
values
  ('request_media', 730, 'legal_hold_review', 'Retain while needed for service, warranty, fraud, or dispute review.'),
  ('job_chat', 1095, 'legal_hold_review', 'Preserve the service record and active dispute evidence.'),
  ('location_points', 7, 'delete', 'Minimize consented, short-lived en-route location data.'),
  ('payment_metadata', 2555, 'archive', 'Retain accounting records without raw financial credentials.'),
  ('warranty_evidence', 1095, 'legal_hold_review', 'Retain through coverage and the operational claim window.'),
  ('dispute_evidence', 2555, 'legal_hold_review', 'Preserve evidence for appeals and legal compliance.'),
  ('audit_logs', 2555, 'archive', 'Preserve privileged and financial accountability.'),
  ('deleted_accounts', null, 'anonymize', 'Remove optional profile data while preserving required financial and safety records.')
on conflict (data_class) do update
set retention_days = excluded.retention_days,
    disposition = excluded.disposition,
    rationale = excluded.rationale,
    is_active = true,
    updated_at = now();

create index operational_alerts_queue_idx
  on public.operational_alerts(status, severity, last_seen_at desc);
create index marketplace_risk_signals_queue_idx
  on public.marketplace_risk_signals(status, severity, last_detected_at desc);
create index marketplace_risk_signals_profile_idx
  on public.marketplace_risk_signals(profile_id, created_at desc);
create index marketplace_abuse_reports_queue_idx
  on public.marketplace_abuse_reports(status, created_at);
create index background_job_runs_job_idx
  on public.background_job_runs(job_code, started_at desc);

create trigger set_operational_alerts_updated_at
  before update on public.operational_alerts
  for each row execute function public.set_updated_at();
create trigger set_marketplace_risk_signals_updated_at
  before update on public.marketplace_risk_signals
  for each row execute function public.set_updated_at();
create trigger set_marketplace_abuse_reports_updated_at
  before update on public.marketplace_abuse_reports
  for each row execute function public.set_updated_at();

alter table public.operational_alerts enable row level security;
alter table public.marketplace_risk_signals enable row level security;
alter table public.marketplace_abuse_reports enable row level security;
alter table public.background_job_runs enable row level security;
alter table public.data_retention_policies enable row level security;

create policy operational_alerts_staff_read on public.operational_alerts
  for select to authenticated
  using (public.has_role('support') or public.is_admin());

create policy marketplace_risk_signals_staff_read on public.marketplace_risk_signals
  for select to authenticated
  using (public.has_role('support') or public.is_admin());

create policy marketplace_abuse_reports_owner_or_staff_read on public.marketplace_abuse_reports
  for select to authenticated
  using (
    reporter_profile_id = public.current_profile_id()
    or target_profile_id = public.current_profile_id()
    or public.has_role('support')
    or public.is_admin()
  );

create policy marketplace_abuse_reports_owner_insert on public.marketplace_abuse_reports
  for insert to authenticated
  with check (reporter_profile_id = public.current_profile_id());

create policy background_job_runs_staff_read on public.background_job_runs
  for select to authenticated
  using (public.has_role('support') or public.is_admin());

create policy retention_policies_staff_read on public.data_retention_policies
  for select to authenticated
  using (public.has_role('support') or public.is_admin());

revoke all on public.operational_alerts from anon, authenticated;
revoke all on public.marketplace_risk_signals from anon, authenticated;
revoke all on public.marketplace_abuse_reports from anon, authenticated;
revoke all on public.background_job_runs from anon, authenticated;
revoke all on public.data_retention_policies from anon, authenticated;

grant select on public.operational_alerts to authenticated;
grant select on public.marketplace_risk_signals to authenticated;
grant select, insert on public.marketplace_abuse_reports to authenticated;
grant select on public.background_job_runs to authenticated;
grant select on public.data_retention_policies to authenticated;

create or replace function public.run_marketplace_maintenance(p_trigger_source text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id uuid;
  v_count integer;
  v_result jsonb := '{}'::jsonb;
begin
  insert into public.background_job_runs(job_code, trigger_source, status)
  values ('marketplace_maintenance', left(coalesce(nullif(trim(p_trigger_source), ''), 'unknown'), 80), 'running')
  returning id into v_run_id;

  if not pg_try_advisory_xact_lock(hashtext('fixmate.marketplace_maintenance')) then
    update public.background_job_runs
       set status = 'skipped_locked',
           finished_at = now(),
           result_safe = '{"reason":"another run owns the lock"}'::jsonb
     where id = v_run_id;
    return jsonb_build_object('runId', v_run_id, 'status', 'skipped_locked');
  end if;

  update public.service_requests
     set status = 'expired',
         matching_status = case when matching_status = 'completed' then matching_status else 'exhausted' end,
         version = version + 1
   where status in ('submitted', 'matching', 'offers_received', 'no_match')
     and selected_offer_id is null
     and expires_at is not null
     and expires_at <= now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('requestsExpired', v_count);

  update public.request_matching_candidates
     set invitation_status = 'expired',
         responded_at = coalesce(responded_at, now())
   where invitation_status in ('queued', 'sent', 'delivered', 'viewed')
     and expires_at is not null
     and expires_at <= now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('invitationsExpired', v_count);

  update public.professional_offers
     set status = 'expired',
         version = version + 1
   where status = 'submitted'
     and valid_until <= now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('offersExpired', v_count);

  update public.arrival_verifications
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('arrivalCodesExpired', v_count);

  update public.job_warranties
     set status = 'active'
   where status = 'pending'
     and starts_at <= now()
     and expires_at > now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('warrantiesActivated', v_count);

  update public.job_warranties
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('warrantiesExpired', v_count);

  update public.domain_outbox
     set status = 'dead_letter',
         locked_at = null,
         lock_token = null,
         last_error_safe = coalesce(last_error_safe, 'Retry limit reached; staff review required.')
   where status in ('pending', 'failed')
     and attempt_count >= 8;
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('outboxDeadLettered', v_count);

  insert into public.operational_alerts(
    dedupe_key, alert_code, severity, title, summary_safe, entity_type, entity_id
  )
  select
    'outbox-dead-letter:' || id,
    'OUTBOX_RETRY_EXHAUSTED',
    'critical',
    'Background event requires review',
    'A marketplace event exhausted its safe retry allowance.',
    'domain_outbox',
    id::text
  from public.domain_outbox
  where status = 'dead_letter'
  on conflict (dedupe_key) do update
  set last_seen_at = now(),
      status = case when operational_alerts.status = 'resolved' then 'resolved' else 'open' end;

  insert into public.operational_alerts(
    dedupe_key, alert_code, severity, title, summary_safe, entity_type, entity_id
  )
  select
    'dispute-overdue:' || id,
    'DISPUTE_RESPONSE_OVERDUE',
    case when priority in ('high', 'urgent') then 'critical' else 'warning' end,
    'Dispute response deadline passed',
    'An unresolved marketplace dispute has passed its response deadline.',
    'job_dispute',
    id::text
  from public.job_disputes
  where status not in ('resolved', 'rejected', 'closed')
    and response_due_at is not null
    and response_due_at < now()
  on conflict (dedupe_key) do update
  set last_seen_at = now(),
      severity = excluded.severity,
      status = case when operational_alerts.status = 'resolved' then 'resolved' else 'open' end;

  insert into public.marketplace_risk_signals(
    dedupe_key, profile_id, signal_type, severity, evidence_summary_safe, reference_type
  )
  select
    'repeated-cancellation:' || customer_id,
    customer_id,
    'repeated_cancellation',
    case when count(*) >= 6 then 'high' else 'medium' end,
    'Multiple customer-request cancellations were recorded within the last 30 days.',
    'service_request'
  from public.service_requests
  where status = 'cancelled'
    and cancelled_at >= now() - interval '30 days'
  group by customer_id
  having count(*) >= 3
  on conflict (dedupe_key) do update
  set last_detected_at = now(),
      severity = excluded.severity;

  insert into public.marketplace_risk_signals(
    dedupe_key, profile_id, signal_type, severity, evidence_summary_safe, reference_type
  )
  select
    'payment-disagreement:' || opened_by,
    opened_by,
    'payment_disagreement',
    case when count(*) >= 5 then 'high' else 'medium' end,
    'Multiple payment disagreements were opened within the last 60 days.',
    'payment_reconciliation_case'
  from public.payment_reconciliation_cases
  where opened_at >= now() - interval '60 days'
  group by opened_by
  having count(*) >= 3
  on conflict (dedupe_key) do update
  set last_detected_at = now(),
      severity = excluded.severity;

  insert into public.marketplace_risk_signals(
    dedupe_key, profile_id, signal_type, severity, evidence_summary_safe, reference_type
  )
  select
    'repeated-no-show-customer:' || customer_id,
    customer_id,
    'repeated_no_show',
    'high',
    'Multiple customer no-show outcomes were recorded within the last 90 days.',
    'booking'
  from public.bookings
  where status = 'customer_no_show'
    and updated_at >= now() - interval '90 days'
  group by customer_id
  having count(*) >= 2
  on conflict (dedupe_key) do update set last_detected_at = now();

  insert into public.marketplace_risk_signals(
    dedupe_key, profile_id, signal_type, severity, evidence_summary_safe, reference_type
  )
  select
    'repeated-no-show-professional:' || professional_id,
    professional_id,
    'repeated_no_show',
    'high',
    'Multiple professional no-show outcomes were recorded within the last 90 days.',
    'booking'
  from public.bookings
  where status = 'professional_no_show'
    and updated_at >= now() - interval '90 days'
  group by professional_id
  having count(*) >= 2
  on conflict (dedupe_key) do update set last_detected_at = now();

  delete from public.rate_limit_events
   where occurred_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('rateLimitEventsPruned', v_count);

  delete from public.idempotency_keys
   where expires_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('idempotencyRecordsPruned', v_count);

  delete from public.job_location_points
   where recorded_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  v_result := v_result || jsonb_build_object('locationPointsPruned', v_count);

  update public.background_job_runs
     set status = 'succeeded',
         finished_at = now(),
         result_safe = v_result
   where id = v_run_id;

  return jsonb_build_object('runId', v_run_id, 'status', 'succeeded', 'result', v_result);
exception
  when others then
    update public.background_job_runs
       set status = 'failed',
           finished_at = now(),
           error_safe = left(sqlstate || ': scheduled maintenance failed', 500)
     where id = v_run_id;
    raise;
end;
$$;

create or replace function public.review_marketplace_risk_signal(
  p_actor_profile_id uuid,
  p_signal_id uuid,
  p_status text,
  p_note text
)
returns public.marketplace_risk_signals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_signal public.marketplace_risk_signals;
begin
  if not exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_profile_id = p_actor_profile_id
       and ur.is_active
       and r.code in ('support', 'admin', 'super_admin')
  ) then
    raise exception using errcode = '42501', message = 'RISK_REVIEW_FORBIDDEN';
  end if;

  if p_status not in ('reviewing', 'dismissed', 'confirmed', 'appealed', 'closed')
     or char_length(trim(p_note)) < 10 then
    raise exception using errcode = '22023', message = 'RISK_REVIEW_INVALID';
  end if;

  update public.marketplace_risk_signals
     set status = p_status,
         reviewed_by = p_actor_profile_id,
         reviewed_at = now(),
         review_note = trim(p_note)
   where id = p_signal_id
   returning * into v_signal;

  if not found then
    raise exception using errcode = 'P0002', message = 'RISK_SIGNAL_NOT_FOUND';
  end if;

  insert into public.audit_logs(actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id,
    'risk_signal.' || p_status,
    'marketplace_risk_signal',
    v_signal.id,
    jsonb_build_object('note', p_note)
  );

  return v_signal;
end;
$$;

create or replace function public.review_operational_alert(
  p_actor_profile_id uuid,
  p_alert_id uuid,
  p_status text,
  p_note text
)
returns public.operational_alerts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alert public.operational_alerts;
begin
  if not exists (
    select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
     where ur.user_profile_id = p_actor_profile_id
       and ur.is_active
       and r.code in ('support', 'admin', 'super_admin')
  ) then
    raise exception using errcode = '42501', message = 'ALERT_REVIEW_FORBIDDEN';
  end if;

  if p_status not in ('acknowledged', 'resolved')
     or char_length(trim(p_note)) < 5 then
    raise exception using errcode = '22023', message = 'ALERT_REVIEW_INVALID';
  end if;

  update public.operational_alerts
     set status = p_status,
         acknowledged_by = case when p_status = 'acknowledged' then p_actor_profile_id else acknowledged_by end,
         acknowledged_at = case when p_status = 'acknowledged' then now() else acknowledged_at end,
         resolved_by = case when p_status = 'resolved' then p_actor_profile_id else resolved_by end,
         resolved_at = case when p_status = 'resolved' then now() else resolved_at end,
         resolution_note = trim(p_note)
   where id = p_alert_id
   returning * into v_alert;

  if not found then
    raise exception using errcode = 'P0002', message = 'OPERATIONAL_ALERT_NOT_FOUND';
  end if;

  insert into public.audit_logs(actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id,
    'operational_alert.' || p_status,
    'operational_alert',
    v_alert.id,
    jsonb_build_object('note', p_note)
  );

  return v_alert;
end;
$$;

revoke all on function public.run_marketplace_maintenance(text)
  from public, anon, authenticated;
grant execute on function public.run_marketplace_maintenance(text)
  to service_role;

revoke all on function public.review_marketplace_risk_signal(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_marketplace_risk_signal(uuid, uuid, text, text)
  to service_role;

revoke all on function public.review_operational_alert(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_operational_alert(uuid, uuid, text, text)
  to service_role;
