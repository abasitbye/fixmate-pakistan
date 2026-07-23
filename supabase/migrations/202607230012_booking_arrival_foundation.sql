-- Booking scheduling, rescheduling, cancellation, no-show, job conversion,
-- arrival verification, and consent-limited location sessions.

create table public.booking_status_history (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.booking_status,
  to_status public.booking_status not null,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  actor_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.cancellation_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('platform', 'service_category', 'city')),
  service_category_id uuid references public.service_categories(id) on delete restrict,
  city_id uuid references public.cities(id) on delete restrict,
  cancelled_by_role text not null check (cancelled_by_role in ('customer', 'professional')),
  minimum_notice_minutes integer not null default 0 check (minimum_notice_minutes >= 0),
  fee_type text not null default 'none' check (fee_type in ('none', 'fixed', 'percentage')),
  fee_percentage_basis_points integer check (fee_percentage_basis_points between 0 and 10000),
  fee_amount_minor bigint check (fee_amount_minor is null or fee_amount_minor >= 0),
  professional_compensation_minor bigint check (professional_compensation_minor is null or professional_compensation_minor >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_from < effective_until)
);

create table public.job_location_sessions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'ended', 'expired', 'revoked')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  consent_record_id uuid references public.user_consents(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (started_at < expires_at)
);

create table public.job_location_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.job_location_sessions(id) on delete cascade,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  accuracy_meters numeric(8,2) check (accuracy_meters is null or accuracy_meters between 0 and 10000),
  recorded_at timestamptz not null default now()
);

alter table public.bookings
  add column confirmation_deadline_at timestamptz not null default (now() + interval '120 minutes'),
  add column cancellation_policy_id uuid references public.cancellation_policies(id) on delete restrict,
  add column cancellation_fee_minor bigint not null default 0 check (cancellation_fee_minor >= 0),
  add column professional_compensation_minor bigint not null default 0 check (professional_compensation_minor >= 0),
  add column cancellation_policy_snapshot jsonb,
  add column cancellation_consented_at timestamptz;

alter table public.booking_reschedule_requests
  add column response_deadline_at timestamptz not null default (now() + interval '24 hours');

create index booking_history_idx on public.booking_status_history (booking_id, created_at);
create index cancellation_policies_active_idx on public.cancellation_policies (scope, is_active, effective_from, effective_until);
create index location_sessions_job_idx on public.job_location_sessions (job_id, status, expires_at);
create index location_points_session_idx on public.job_location_points (session_id, recorded_at);
create unique index one_active_location_session_idx on public.job_location_sessions (job_id) where status = 'active';

create trigger set_cancellation_policies_updated_at
  before update on public.cancellation_policies
  for each row execute function public.set_updated_at();

insert into public.consent_types (code, name, current_version, is_required)
values (
  'job_location_sharing',
  'Job Location Sharing',
  '1.0',
  false
)
on conflict (code) do nothing;

insert into public.system_settings (key, value, is_public, description)
values
  ('phase2.booking.confirmation_minutes', '120'::jsonb, false, 'Professional booking confirmation window.'),
  ('phase2.booking.en_route_window_minutes', '240'::jsonb, false, 'How early a professional can mark a job en route.'),
  ('phase2.booking.reschedule_response_minutes', '1440'::jsonb, false, 'Response window for reschedule proposals.'),
  ('phase2.arrival.code_minutes', '30'::jsonb, false, 'Arrival code validity window.'),
  ('phase2.arrival.max_attempts', '5'::jsonb, false, 'Maximum arrival code attempts.'),
  ('phase2.location.session_minutes', '240'::jsonb, false, 'Maximum location sharing session duration.'),
  ('phase2.location.retention_hours', '24'::jsonb, false, 'Retention window for limited job location data.')
on conflict (key) do nothing;

create or replace function public.record_booking_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := coalesce(
    public.current_profile_id(),
    nullif(current_setting('app.actor_profile_id', true), '')::uuid
  );
  v_actor_role text := coalesce(nullif(current_setting('app.actor_role', true), ''), 'system');
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.booking_status_history (
      booking_id, from_status, to_status, actor_user_id, actor_role
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      v_actor_id,
      v_actor_role
    );
  end if;
  return new;
end;
$$;

create trigger booking_status_history_trigger
  after insert or update of status on public.bookings
  for each row execute function public.record_booking_status();

create or replace function public.confirm_booking(
  p_actor_profile_id uuid,
  p_booking_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_booking public.bookings;
  v_request public.service_requests;
  v_job public.jobs;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'booking.confirm' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_job from public.jobs where id = v_existing.resource_id;
    return v_job;
  end if;

  select * into v_booking from public.bookings
  where id = p_booking_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status <> 'pending_confirmation' then raise exception using errcode = '22023', message = 'BOOKING_NOT_CONFIRMABLE'; end if;
  if v_booking.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if v_booking.confirmation_deadline_at <= now() then raise exception using errcode = '22023', message = 'BOOKING_CONFIRMATION_EXPIRED'; end if;
  if v_booking.scheduled_end_at <= now() then raise exception using errcode = '22023', message = 'BOOKING_SCHEDULE_EXPIRED'; end if;
  if exists (
    select 1 from public.bookings b
    where b.professional_id = p_actor_profile_id and b.id <> p_booking_id
      and b.status in ('confirmed', 'rescheduled', 'converted_to_job')
      and b.scheduled_start_at < v_booking.scheduled_end_at
      and b.scheduled_end_at > v_booking.scheduled_start_at
  ) then raise exception using errcode = '22023', message = 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;

  update public.bookings set
    status = 'confirmed', confirmation_status = 'confirmed',
    confirmed_at = now(), exact_address_released_at = now(), version = version + 1
  where id = p_booking_id returning * into v_booking;
  select * into v_request from public.service_requests where id = v_booking.request_id;

  insert into public.jobs (
    booking_id, request_id, customer_id, professional_id, property_id,
    service_category_id, service_subcategory_id, status, scheduled_start_at
  ) values (
    v_booking.id, v_booking.request_id, v_booking.customer_id, v_booking.professional_id,
    v_booking.property_id, v_request.service_category_id, v_request.service_subcategory_id,
    'confirmed', v_booking.scheduled_start_at
  ) returning * into v_job;
  update public.bookings set status = 'converted_to_job', version = version + 1 where id = p_booking_id;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'booking.confirm', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('jobId', v_job.id), 'job', v_job.id, now() + interval '24 hours'
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_booking.customer_id, 'in_app', 'booking.confirmed', 'Booking confirmed',
    'The professional confirmed your schedule. Exact address access is now limited to this booking.',
    jsonb_build_object('bookingId', p_booking_id, 'jobId', v_job.id, 'deepLink', '/customer/jobs/' || v_job.id::text)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'booking.confirmed', 'job', v_job.id,
    jsonb_build_object('bookingId', p_booking_id, 'customerId', v_booking.customer_id, 'professionalId', p_actor_profile_id)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'booking.confirm', 'job', v_job.id::text,
    jsonb_build_object('bookingId', p_booking_id, 'addressReleasedAt', v_booking.exact_address_released_at)
  );
  return v_job;
end;
$$;

create or replace function public.request_booking_reschedule(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_booking_id uuid,
  p_expected_version integer,
  p_proposed_start_at timestamptz,
  p_proposed_end_at timestamptz,
  p_reason text
)
returns public.booking_reschedule_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_reschedule public.booking_reschedule_requests;
begin
  if p_actor_role not in ('customer', 'professional') then raise exception using errcode = '42501', message = 'INVALID_ACTOR'; end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', p_actor_role, true);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or not (v_booking.customer_id = p_actor_profile_id or v_booking.professional_id = p_actor_profile_id) then
    raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.status not in ('pending_confirmation', 'confirmed', 'rescheduled', 'converted_to_job') then
    raise exception using errcode = '22023', message = 'BOOKING_NOT_RESCHEDULABLE';
  end if;
  if v_booking.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if p_proposed_start_at <= now() or p_proposed_start_at >= p_proposed_end_at then
    raise exception using errcode = '22023', message = 'INVALID_SCHEDULE';
  end if;
  insert into public.booking_reschedule_requests (
    booking_id, requested_by, proposed_start_at, proposed_end_at, reason, response_deadline_at
  ) values (
    p_booking_id, p_actor_profile_id, p_proposed_start_at, p_proposed_end_at, trim(p_reason),
    now() + interval '24 hours'
  ) returning * into v_reschedule;
  update public.bookings set
    status = 'reschedule_requested', reschedule_status = 'pending', version = version + 1
  where id = p_booking_id;
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    case when p_actor_profile_id = v_booking.customer_id then v_booking.professional_id else v_booking.customer_id end,
    'in_app', 'booking.reschedule_requested', 'Reschedule requested',
    'Review the proposed date, time, and reason.',
    jsonb_build_object('bookingId', p_booking_id, 'rescheduleId', v_reschedule.id)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('booking.reschedule_requested', 'booking', p_booking_id, jsonb_build_object('rescheduleId', v_reschedule.id));
  return v_reschedule;
end;
$$;

create or replace function public.respond_booking_reschedule(
  p_actor_profile_id uuid,
  p_booking_id uuid,
  p_reschedule_id uuid,
  p_accept boolean
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_reschedule public.booking_reschedule_requests;
  v_previous_start_at timestamptz;
  v_previous_end_at timestamptz;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  select * into v_reschedule from public.booking_reschedule_requests
  where id = p_reschedule_id and booking_id = p_booking_id and status = 'pending' for update;
  if not found then raise exception using errcode = 'P0002', message = 'RESCHEDULE_NOT_FOUND'; end if;
  if v_reschedule.response_deadline_at <= now() then
    update public.booking_reschedule_requests set status = 'expired' where id = p_reschedule_id;
    raise exception using errcode = '22023', message = 'RESCHEDULE_EXPIRED';
  end if;
  if not (v_booking.customer_id = p_actor_profile_id or v_booking.professional_id = p_actor_profile_id)
    or v_reschedule.requested_by = p_actor_profile_id then
    raise exception using errcode = '42501', message = 'RESCHEDULE_RESPONSE_FORBIDDEN';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', case when p_actor_profile_id = v_booking.customer_id then 'customer' else 'professional' end, true);
  v_previous_start_at := v_booking.scheduled_start_at;
  v_previous_end_at := v_booking.scheduled_end_at;
  if p_accept and exists (
    select 1 from public.bookings b
    where b.professional_id = v_booking.professional_id
      and b.id <> p_booking_id
      and b.status in ('confirmed', 'rescheduled', 'converted_to_job')
      and b.scheduled_start_at < v_reschedule.proposed_end_at
      and b.scheduled_end_at > v_reschedule.proposed_start_at
  ) then
    raise exception using errcode = '22023', message = 'PROFESSIONAL_SCHEDULE_CONFLICT';
  end if;
  update public.booking_reschedule_requests set
    status = case when p_accept then 'accepted' else 'rejected' end,
    responded_by = p_actor_profile_id, responded_at = now()
  where id = p_reschedule_id;
  update public.bookings set
    scheduled_start_at = case when p_accept then v_reschedule.proposed_start_at else scheduled_start_at end,
    scheduled_end_at = case when p_accept then v_reschedule.proposed_end_at else scheduled_end_at end,
    status = case when p_accept then 'rescheduled' else 'confirmed' end,
    reschedule_status = case when p_accept then 'accepted' else 'rejected' end,
    version = version + 1
  where id = p_booking_id returning * into v_booking;
  update public.jobs set
    scheduled_start_at = v_booking.scheduled_start_at, version = version + 1
  where booking_id = p_booking_id and p_accept and status in ('created', 'confirmed');
  if p_accept and exists (select 1 from public.jobs where booking_id = p_booking_id) then
    update public.bookings set status = 'converted_to_job', version = version + 1
    where id = p_booking_id returning * into v_booking;
  end if;
  update public.booking_status_history set
    reason = v_reschedule.reason,
    metadata = jsonb_build_object(
      'previousStartAt', v_previous_start_at,
      'previousEndAt', v_previous_end_at,
      'proposedStartAt', v_reschedule.proposed_start_at,
      'proposedEndAt', v_reschedule.proposed_end_at,
      'accepted', p_accept
    )
  where id = (
    select id from public.booking_status_history
    where booking_id = p_booking_id order by created_at desc, id desc limit 1
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_reschedule.requested_by, 'in_app',
    case when p_accept then 'booking.reschedule_accepted' else 'booking.reschedule_rejected' end,
    case when p_accept then 'Reschedule accepted' else 'Reschedule declined' end,
    case when p_accept then 'The proposed booking time was accepted.' else 'The proposed booking time was declined.' end,
    jsonb_build_object('bookingId', p_booking_id, 'rescheduleId', p_reschedule_id)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    case when p_accept then 'booking.reschedule_accepted' else 'booking.reschedule_rejected' end,
    'booking', p_booking_id, jsonb_build_object('rescheduleId', p_reschedule_id)
  );
  return v_booking;
end;
$$;

create or replace function public.preview_booking_cancellation(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_policy public.cancellation_policies;
  v_request public.service_requests;
  v_property public.properties;
  v_snapshot public.accepted_offer_snapshots;
  v_base_amount bigint := 0;
  v_fee bigint := 0;
  v_compensation bigint := 0;
begin
  if p_actor_role not in ('customer', 'professional', 'support', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'INVALID_ACTOR';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if p_actor_role = 'customer' and v_booking.customer_id <> p_actor_profile_id then
    raise exception using errcode = '42501', message = 'BOOKING_FORBIDDEN';
  end if;
  if p_actor_role = 'professional' and v_booking.professional_id <> p_actor_profile_id then
    raise exception using errcode = '42501', message = 'BOOKING_FORBIDDEN';
  end if;
  select * into v_request from public.service_requests where id = v_booking.request_id;
  select * into v_property from public.properties where id = v_booking.property_id;
  select * into v_snapshot from public.accepted_offer_snapshots where id = v_booking.accepted_offer_snapshot_id;
  v_base_amount := coalesce(
    nullif(v_snapshot.commercial_terms->>'totalAmountMinor', '')::bigint,
    nullif(v_snapshot.commercial_terms->>'maximumAmountMinor', '')::bigint,
    nullif(v_snapshot.commercial_terms->>'inspectionFeeMinor', '')::bigint,
    0
  );
  select cp.* into v_policy
  from public.cancellation_policies cp
  where cp.is_active
    and cp.cancelled_by_role = case when p_actor_role = 'professional' then 'professional' else 'customer' end
    and cp.effective_from <= now()
    and (cp.effective_until is null or cp.effective_until > now())
    and now() >= v_booking.scheduled_start_at - make_interval(mins => cp.minimum_notice_minutes)
    and (
      cp.scope = 'platform'
      or (cp.scope = 'service_category' and cp.service_category_id = v_request.service_category_id)
      or (cp.scope = 'city' and cp.city_id = v_property.city_id)
    )
  order by
    case cp.scope when 'service_category' then 3 when 'city' then 2 else 1 end desc,
    cp.effective_from desc
  limit 1;
  if found then
    v_fee := case v_policy.fee_type
      when 'fixed' then coalesce(v_policy.fee_amount_minor, 0)
      when 'percentage' then round(v_base_amount * coalesce(v_policy.fee_percentage_basis_points, 0)::numeric / 10000)::bigint
      else 0
    end;
    v_compensation := coalesce(v_policy.professional_compensation_minor, 0);
  end if;
  return jsonb_build_object(
    'bookingId', v_booking.id,
    'policyId', v_policy.id,
    'policyName', v_policy.name,
    'feeMinor', v_fee,
    'professionalCompensationMinor', v_compensation,
    'currencyCode', 'PKR',
    'requiresAcknowledgement', v_fee > 0,
    'scheduledStartAt', v_booking.scheduled_start_at
  );
end;
$$;

create or replace function public.cancel_booking(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_booking_id uuid,
  p_expected_version integer,
  p_reason text,
  p_policy_acknowledged boolean
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_preview jsonb;
begin
  if p_actor_role not in ('customer', 'professional', 'support', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'INVALID_ACTOR';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', p_actor_role, true);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if p_actor_role = 'customer' and v_booking.customer_id <> p_actor_profile_id then raise exception using errcode = '42501', message = 'BOOKING_FORBIDDEN'; end if;
  if p_actor_role = 'professional' and v_booking.professional_id <> p_actor_profile_id then raise exception using errcode = '42501', message = 'BOOKING_FORBIDDEN'; end if;
  if v_booking.status in ('cancelled', 'completed', 'customer_no_show', 'professional_no_show') then
    raise exception using errcode = '22023', message = 'BOOKING_NOT_CANCELLABLE';
  end if;
  if v_booking.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  v_preview := public.preview_booking_cancellation(p_actor_profile_id, p_actor_role, p_booking_id);
  if coalesce((v_preview->>'requiresAcknowledgement')::boolean, false) and not p_policy_acknowledged then
    raise exception using errcode = '22023', message = 'CANCELLATION_POLICY_ACKNOWLEDGEMENT_REQUIRED';
  end if;
  update public.bookings set
    status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor_profile_id,
    cancellation_reason = trim(p_reason),
    cancellation_policy_id = nullif(v_preview->>'policyId', '')::uuid,
    cancellation_fee_minor = coalesce((v_preview->>'feeMinor')::bigint, 0),
    professional_compensation_minor = coalesce((v_preview->>'professionalCompensationMinor')::bigint, 0),
    cancellation_policy_snapshot = v_preview,
    cancellation_consented_at = case
      when coalesce((v_preview->>'requiresAcknowledgement')::boolean, false) then now()
      else null
    end,
    version = version + 1
  where id = p_booking_id returning * into v_booking;
  update public.jobs set status = 'cancelled', cancelled_at = now(), cancellation_reason = trim(p_reason), version = version + 1
  where booking_id = p_booking_id and status not in ('completed', 'closed');
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'booking.cancelled', 'booking', p_booking_id,
    jsonb_build_object(
      'cancelledBy', p_actor_role,
      'reason', trim(p_reason),
      'feeMinor', v_booking.cancellation_fee_minor,
      'professionalCompensationMinor', v_booking.professional_compensation_minor,
      'policyId', v_booking.cancellation_policy_id
    )
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    case when p_actor_profile_id = v_booking.customer_id then v_booking.professional_id else v_booking.customer_id end,
    'in_app', 'booking.cancelled', 'Booking cancelled',
    'The booking was cancelled. Open it to review the recorded outcome.',
    jsonb_build_object('bookingId', p_booking_id)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'booking.cancel', 'booking', p_booking_id::text, jsonb_build_object('role', p_actor_role, 'reason', trim(p_reason)));
  return v_booking;
end;
$$;

create or replace function public.record_booking_no_show(
  p_actor_profile_id uuid,
  p_booking_id uuid,
  p_no_show_party text,
  p_reason text,
  p_evidence_reference text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare v_booking public.bookings;
begin
  if p_no_show_party not in ('customer', 'professional', 'mutual', 'access_issue', 'safety') then
    raise exception using errcode = '22023', message = 'INVALID_NO_SHOW_PARTY';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'staff', true);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status not in ('confirmed', 'rescheduled', 'converted_to_job') then
    raise exception using errcode = '22023', message = 'NO_SHOW_NOT_RECORDABLE';
  end if;
  update public.bookings set
    status = case
      when p_no_show_party = 'professional' then 'professional_no_show'::public.booking_status
      when p_no_show_party = 'customer' then 'customer_no_show'::public.booking_status
      else 'cancelled'::public.booking_status
    end,
    no_show_party = p_no_show_party, cancellation_reason = trim(p_reason), version = version + 1
  where id = p_booking_id returning * into v_booking;
  update public.jobs set status = 'cancelled', cancellation_reason = 'No-show: ' || trim(p_reason), version = version + 1
  where booking_id = p_booking_id and status not in ('completed', 'closed');
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'booking.no_show_recorded', 'booking', p_booking_id,
    jsonb_build_object(
      'party', p_no_show_party,
      'reason', trim(p_reason),
      'evidenceReference', nullif(trim(p_evidence_reference), '')
    )
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'booking.no_show_record', 'booking', p_booking_id::text,
    jsonb_build_object(
      'party', p_no_show_party,
      'reason', trim(p_reason),
      'evidenceReference', nullif(trim(p_evidence_reference), '')
    )
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values
    (
      v_booking.customer_id, 'in_app', 'booking.no_show_recorded', 'Booking outcome recorded',
      'Support recorded the attendance outcome. You may contact support if you disagree.',
      jsonb_build_object('bookingId', p_booking_id)
    ),
    (
      v_booking.professional_id, 'in_app', 'booking.no_show_recorded', 'Booking outcome recorded',
      'Support recorded the attendance outcome. You may contact support if you disagree.',
      jsonb_build_object('bookingId', p_booking_id)
    );
  return v_booking;
end;
$$;

create or replace function public.mark_job_en_route(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_expected_version integer
)
returns public.jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_window_minutes integer := 240;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'confirmed' then raise exception using errcode = '22023', message = 'JOB_NOT_READY_FOR_TRAVEL'; end if;
  if v_job.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'phase2.booking.en_route_window_minutes'),
    240
  ) into v_window_minutes;
  if now() < v_job.scheduled_start_at - make_interval(mins => v_window_minutes) then
    raise exception using errcode = '22023', message = 'EN_ROUTE_TOO_EARLY';
  end if;
  update public.jobs set status = 'en_route', actual_en_route_at = now(), version = version + 1
  where id = p_job_id returning * into v_job;
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_job.customer_id, 'in_app', 'job.en_route', 'Professional is en route',
    'Your professional has started travelling to the booking.',
    jsonb_build_object('jobId', p_job_id, 'deepLink', '/customer/jobs/' || p_job_id::text)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('job.en_route', 'job', p_job_id, jsonb_build_object('professionalId', p_actor_profile_id));
  return v_job;
end;
$$;

create or replace function public.regenerate_arrival_code(
  p_actor_profile_id uuid,
  p_job_id uuid
)
returns table (verification_id uuid, arrival_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_code text;
  v_verification public.arrival_verifications;
  v_random_bytes bytea;
  v_random_number bigint;
  v_code_minutes integer := 30;
  v_max_attempts integer := 5;
begin
  select * into v_job from public.jobs where id = p_job_id and customer_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status not in ('confirmed', 'en_route') then raise exception using errcode = '22023', message = 'ARRIVAL_CODE_NOT_AVAILABLE'; end if;
  update public.arrival_verifications set status = 'revoked', revoked_at = now()
  where job_id = p_job_id and status = 'active';
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'phase2.arrival.code_minutes'),
    30
  ) into v_code_minutes;
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'phase2.arrival.max_attempts'),
    5
  ) into v_max_attempts;
  v_random_bytes := extensions.gen_random_bytes(4);
  v_random_number :=
    get_byte(v_random_bytes, 0)::bigint * 16777216
    + get_byte(v_random_bytes, 1)::bigint * 65536
    + get_byte(v_random_bytes, 2)::bigint * 256
    + get_byte(v_random_bytes, 3)::bigint;
  v_code := lpad((v_random_number % 1000000)::text, 6, '0');
  insert into public.arrival_verifications (job_id, code_hash, expires_at, max_attempts)
  values (
    p_job_id,
    extensions.crypt(v_code, extensions.gen_salt('bf', 8)),
    now() + make_interval(mins => v_code_minutes),
    v_max_attempts
  )
  returning * into v_verification;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'arrival_code.regenerate', 'job', p_job_id::text, jsonb_build_object('verificationId', v_verification.id));
  return query select v_verification.id, v_code, v_verification.expires_at;
end;
$$;

create or replace function public.verify_arrival_code(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_code text
)
returns table (
  verification_status text,
  verified_job_id uuid,
  attempts_remaining integer,
  verified_job_status public.job_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_verification public.arrival_verifications;
  v_attempt_count integer;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_job from public.jobs where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'en_route' then raise exception using errcode = '22023', message = 'ARRIVAL_NOT_VERIFIABLE'; end if;
  select * into v_verification from public.arrival_verifications
  where job_id = p_job_id and status = 'active' order by created_at desc limit 1 for update;
  if not found then raise exception using errcode = 'P0002', message = 'ARRIVAL_CODE_NOT_FOUND'; end if;
  if v_verification.expires_at <= now() then
    update public.arrival_verifications set status = 'expired' where id = v_verification.id;
    return query select 'expired'::text, p_job_id, 0, v_job.status;
    return;
  end if;
  if v_verification.attempt_count >= v_verification.max_attempts then
    update public.arrival_verifications set status = 'locked' where id = v_verification.id;
    return query select 'locked'::text, p_job_id, 0, v_job.status;
    return;
  end if;
  update public.arrival_verifications
  set attempt_count = attempt_count + 1
  where id = v_verification.id
  returning attempt_count into v_attempt_count;
  if extensions.crypt(p_code, v_verification.code_hash) <> v_verification.code_hash then
    if v_attempt_count >= v_verification.max_attempts then
      update public.arrival_verifications set status = 'locked' where id = v_verification.id;
      return query select 'locked'::text, p_job_id, 0, v_job.status;
    else
      return query select
        'invalid'::text,
        p_job_id,
        v_verification.max_attempts - v_attempt_count,
        v_job.status;
    end if;
    return;
  end if;
  update public.arrival_verifications set
    status = 'verified', verified_at = now(), verified_by_professional_id = p_actor_profile_id
  where id = v_verification.id;
  update public.jobs set status = 'arrived', actual_arrived_at = now(), version = version + 1
  where id = p_job_id returning * into v_job;
  update public.job_location_sessions
  set status = 'ended', ended_at = now()
  where job_id = p_job_id and status = 'active';
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('job.arrival_verified', 'job', p_job_id, jsonb_build_object('verificationId', v_verification.id));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'job.arrival_verified', 'job', p_job_id::text, jsonb_build_object('verificationId', v_verification.id));
  return query select 'verified'::text, v_job.id, v_verification.max_attempts - v_attempt_count, v_job.status;
end;
$$;

create or replace function public.start_job_location_session(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_consent boolean,
  p_ip_address inet,
  p_user_agent text
)
returns public.job_location_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs;
  v_consent_type public.consent_types;
  v_consent public.user_consents;
  v_session public.job_location_sessions;
  v_session_minutes integer := 240;
  v_expires_at timestamptz;
begin
  if not p_consent then
    raise exception using errcode = '22023', message = 'LOCATION_CONSENT_REQUIRED';
  end if;
  select * into v_job from public.jobs
  where id = p_job_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND'; end if;
  if v_job.status <> 'en_route' then
    raise exception using errcode = '22023', message = 'LOCATION_SHARING_NOT_AVAILABLE';
  end if;
  select * into v_consent_type from public.consent_types
  where code = 'job_location_sharing' and is_active;
  if not found then raise exception using errcode = 'P0002', message = 'LOCATION_CONSENT_TYPE_NOT_FOUND'; end if;
  insert into public.user_consents (
    user_profile_id, consent_type_id, version, accepted, ip_address, user_agent, recorded_at
  ) values (
    p_actor_profile_id, v_consent_type.id, v_consent_type.current_version,
    true, p_ip_address, left(nullif(trim(p_user_agent), ''), 500), now()
  )
  on conflict (user_profile_id, consent_type_id, version)
  do update set
    accepted = true,
    ip_address = excluded.ip_address,
    user_agent = excluded.user_agent,
    recorded_at = now()
  returning * into v_consent;
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'phase2.location.session_minutes'),
    240
  ) into v_session_minutes;
  v_expires_at := least(
    now() + make_interval(mins => v_session_minutes),
    v_job.scheduled_start_at + interval '6 hours'
  );
  insert into public.job_location_sessions (
    job_id, professional_id, customer_id, expires_at, consent_record_id
  ) values (
    p_job_id, p_actor_profile_id, v_job.customer_id, v_expires_at, v_consent.id
  )
  returning * into v_session;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'job.location_sharing_start', 'job', p_job_id::text,
    jsonb_build_object('sessionId', v_session.id, 'expiresAt', v_session.expires_at)
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'job.location_sharing_started', 'job', p_job_id,
    jsonb_build_object('sessionId', v_session.id, 'expiresAt', v_session.expires_at)
  );
  return v_session;
end;
$$;

create or replace function public.record_job_location_point(
  p_actor_profile_id uuid,
  p_job_id uuid,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric
)
returns public.job_location_points
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.job_location_sessions;
  v_point public.job_location_points;
begin
  select s.* into v_session
  from public.job_location_sessions s
  join public.jobs j on j.id = s.job_id
  where s.job_id = p_job_id
    and s.professional_id = p_actor_profile_id
    and j.status = 'en_route'
    and s.status = 'active'
  order by s.created_at desc
  limit 1
  for update of s;
  if not found then raise exception using errcode = 'P0002', message = 'LOCATION_SESSION_NOT_FOUND'; end if;
  if v_session.expires_at <= now() then
    update public.job_location_sessions set status = 'expired', ended_at = now() where id = v_session.id;
    return null;
  end if;
  insert into public.job_location_points (
    session_id, latitude, longitude, accuracy_meters
  ) values (
    v_session.id, p_latitude, p_longitude, p_accuracy_meters
  ) returning * into v_point;
  return v_point;
end;
$$;

create or replace function public.stop_job_location_session(
  p_actor_profile_id uuid,
  p_job_id uuid
)
returns public.job_location_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.job_location_sessions;
begin
  update public.job_location_sessions
  set status = 'ended', ended_at = now()
  where id = (
    select s.id from public.job_location_sessions s
    where s.job_id = p_job_id
      and s.professional_id = p_actor_profile_id
      and s.status = 'active'
    order by s.created_at desc
    limit 1
    for update
  )
  returning * into v_session;
  if not found then raise exception using errcode = 'P0002', message = 'LOCATION_SESSION_NOT_FOUND'; end if;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'job.location_sharing_stop', 'job', p_job_id::text,
    jsonb_build_object('sessionId', v_session.id)
  );
  return v_session;
end;
$$;

create or replace function public.purge_expired_job_location_data()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention_hours integer := 24;
  v_deleted integer := 0;
begin
  select coalesce(
    (select (value #>> '{}')::integer from public.system_settings where key = 'phase2.location.retention_hours'),
    24
  ) into v_retention_hours;
  update public.job_location_sessions
  set status = 'expired', ended_at = coalesce(ended_at, now())
  where status = 'active' and expires_at <= now();
  delete from public.job_location_sessions
  where coalesce(ended_at, expires_at) < now() - make_interval(hours => v_retention_hours);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'booking_status_history', 'cancellation_policies', 'job_location_sessions', 'job_location_points'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

create policy booking_history_participant_staff_read on public.booking_status_history for select to authenticated
  using (exists (
    select 1 from public.bookings b where b.id = booking_id
      and (b.customer_id = public.current_profile_id() or b.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy cancellation_policies_authenticated_read on public.cancellation_policies for select to authenticated using (is_active or public.is_admin());
create policy location_sessions_participant_staff_read on public.job_location_sessions for select to authenticated
  using (customer_id = public.current_profile_id() or professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy location_points_participant_staff_read on public.job_location_points for select to authenticated
  using (exists (
    select 1 from public.job_location_sessions s where s.id = session_id
      and (s.customer_id = public.current_profile_id() or s.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));

revoke insert, update, delete on public.booking_status_history from authenticated;
revoke insert, update, delete on public.cancellation_policies from authenticated;
revoke insert, update, delete on public.job_location_sessions from authenticated;
revoke insert, update, delete on public.job_location_points from authenticated;

revoke all on function public.confirm_booking(uuid,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.request_booking_reschedule(uuid,text,uuid,integer,timestamptz,timestamptz,text) from public, anon, authenticated;
revoke all on function public.respond_booking_reschedule(uuid,uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function public.preview_booking_cancellation(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.cancel_booking(uuid,text,uuid,integer,text,boolean) from public, anon, authenticated;
revoke all on function public.record_booking_no_show(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.mark_job_en_route(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.regenerate_arrival_code(uuid,uuid) from public, anon, authenticated;
revoke all on function public.verify_arrival_code(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.start_job_location_session(uuid,uuid,boolean,inet,text) from public, anon, authenticated;
revoke all on function public.record_job_location_point(uuid,uuid,numeric,numeric,numeric) from public, anon, authenticated;
revoke all on function public.stop_job_location_session(uuid,uuid) from public, anon, authenticated;
revoke all on function public.purge_expired_job_location_data() from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.request_booking_reschedule(uuid,text,uuid,integer,timestamptz,timestamptz,text) to service_role;
grant execute on function public.respond_booking_reschedule(uuid,uuid,uuid,boolean) to service_role;
grant execute on function public.preview_booking_cancellation(uuid,text,uuid) to service_role;
grant execute on function public.cancel_booking(uuid,text,uuid,integer,text,boolean) to service_role;
grant execute on function public.record_booking_no_show(uuid,uuid,text,text,text) to service_role;
grant execute on function public.mark_job_en_route(uuid,uuid,integer) to service_role;
grant execute on function public.regenerate_arrival_code(uuid,uuid) to service_role;
grant execute on function public.verify_arrival_code(uuid,uuid,text) to service_role;
grant execute on function public.start_job_location_session(uuid,uuid,boolean,inet,text) to service_role;
grant execute on function public.record_job_location_point(uuid,uuid,numeric,numeric,numeric) to service_role;
grant execute on function public.stop_job_location_session(uuid,uuid) to service_role;
grant execute on function public.purge_expired_job_location_data() to service_role;
