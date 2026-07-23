-- Participant cancellation is a pre-arrival workflow. After verified arrival,
-- job issues move through the controlled job/dispute paths added in later
-- checkpoints instead of silently cancelling an active service.

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
  v_job public.jobs;
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
  select * into v_job from public.jobs where booking_id = p_booking_id for update;
  if found and (v_job.actual_arrived_at is not null or v_job.status not in ('confirmed', 'en_route')) then
    raise exception using errcode = '22023', message = 'BOOKING_NOT_CANCELLABLE';
  end if;
  if v_booking.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  v_preview := public.preview_booking_cancellation(p_actor_profile_id, p_actor_role, p_booking_id);
  if coalesce((v_preview->>'requiresAcknowledgement')::boolean, false) and not p_policy_acknowledged then
    raise exception using errcode = '22023', message = 'CANCELLATION_POLICY_ACKNOWLEDGEMENT_REQUIRED';
  end if;
  update public.bookings set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = p_actor_profile_id,
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
  update public.jobs set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = trim(p_reason),
    version = version + 1
  where booking_id = p_booking_id and status in ('confirmed', 'en_route');
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
  values (
    p_actor_profile_id, 'booking.cancel', 'booking', p_booking_id::text,
    jsonb_build_object(
      'role', p_actor_role,
      'reason', trim(p_reason),
      'feeMinor', v_booking.cancellation_fee_minor,
      'policyId', v_booking.cancellation_policy_id
    )
  );
  return v_booking;
end;
$$;

revoke all on function public.cancel_booking(uuid,text,uuid,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.cancel_booking(uuid,text,uuid,integer,text,boolean) to service_role;
