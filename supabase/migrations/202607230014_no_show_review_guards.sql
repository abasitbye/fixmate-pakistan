-- No-show outcomes are staff-reviewed, cannot be recorded before the scheduled
-- start or after verified arrival, and require an evidence/support reference
-- for a unilateral no-show finding.

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
declare
  v_booking public.bookings;
  v_job public.jobs;
begin
  if p_no_show_party not in ('customer', 'professional', 'mutual', 'access_issue', 'safety') then
    raise exception using errcode = '22023', message = 'INVALID_NO_SHOW_PARTY';
  end if;
  if p_no_show_party in ('customer', 'professional') and nullif(trim(p_evidence_reference), '') is null then
    raise exception using errcode = '22023', message = 'NO_SHOW_EVIDENCE_REQUIRED';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'staff', true);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status not in ('confirmed', 'rescheduled', 'converted_to_job')
    or now() < v_booking.scheduled_start_at then
    raise exception using errcode = '22023', message = 'NO_SHOW_NOT_RECORDABLE';
  end if;
  select * into v_job from public.jobs where booking_id = p_booking_id for update;
  if found and (v_job.actual_arrived_at is not null or v_job.status not in ('confirmed', 'en_route')) then
    raise exception using errcode = '22023', message = 'NO_SHOW_NOT_RECORDABLE';
  end if;
  update public.bookings set
    status = case
      when p_no_show_party = 'professional' then 'professional_no_show'::public.booking_status
      when p_no_show_party = 'customer' then 'customer_no_show'::public.booking_status
      else 'cancelled'::public.booking_status
    end,
    no_show_party = p_no_show_party,
    cancellation_reason = trim(p_reason),
    version = version + 1
  where id = p_booking_id returning * into v_booking;
  update public.jobs set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = 'No-show review: ' || trim(p_reason),
    version = version + 1
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

revoke all on function public.record_booking_no_show(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.record_booking_no_show(uuid,uuid,text,text,text) to service_role;
