-- Forward-only correction: a schedule can be agreed before initial professional
-- confirmation, and a rejected pre-confirmation proposal must return to the
-- pending confirmation state.

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
  if v_booking.status not in ('pending_confirmation', 'rescheduled') or v_booking.confirmed_at is not null then
    raise exception using errcode = '22023', message = 'BOOKING_NOT_CONFIRMABLE';
  end if;
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
  v_has_job boolean;
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
  select exists (select 1 from public.jobs where booking_id = p_booking_id) into v_has_job;
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
    status = case
      when v_has_job then 'converted_to_job'::public.booking_status
      when p_accept then 'rescheduled'::public.booking_status
      when confirmed_at is null then 'pending_confirmation'::public.booking_status
      else 'confirmed'::public.booking_status
    end,
    reschedule_status = case when p_accept then 'accepted' else 'rejected' end,
    version = version + 1
  where id = p_booking_id returning * into v_booking;
  update public.jobs set
    scheduled_start_at = v_booking.scheduled_start_at, version = version + 1
  where booking_id = p_booking_id and p_accept and status in ('created', 'confirmed');
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

revoke all on function public.confirm_booking(uuid,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.respond_booking_reschedule(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.confirm_booking(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.respond_booking_reschedule(uuid,uuid,uuid,boolean) to service_role;
