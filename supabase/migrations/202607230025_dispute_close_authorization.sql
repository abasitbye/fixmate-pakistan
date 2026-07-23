-- Require a job participant or staff member to acknowledge and close a
-- resolved dispute. Reopening remains restricted to staff.

create or replace function public.transition_resolved_dispute(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_dispute_id uuid,
  p_action text,
  p_reason text
)
returns public.job_disputes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute public.job_disputes;
  v_job public.jobs;
  v_before text;
begin
  select *
    into v_dispute
    from public.job_disputes
   where id = p_dispute_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'DISPUTE_NOT_FOUND';
  end if;

  select *
    into v_job
    from public.jobs
   where id = v_dispute.job_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'JOB_NOT_FOUND';
  end if;

  v_before := v_dispute.status;

  if p_action = 'close' then
    if p_actor_profile_id not in (v_job.customer_id, v_job.professional_id)
       and p_actor_role not in ('support', 'admin', 'super_admin') then
      raise exception using errcode = '42501', message = 'DISPUTE_CLOSE_FORBIDDEN';
    end if;

    if v_dispute.status <> 'resolved' then
      raise exception using errcode = '22023', message = 'DISPUTE_NOT_CLOSABLE';
    end if;

    update public.job_disputes
       set status = 'closed',
           version = version + 1
     where id = v_dispute.id
     returning * into v_dispute;

    update public.jobs
       set dispute_status = 'closed'
     where id = v_dispute.job_id;
  elsif p_action = 'reopen' then
    if p_actor_role not in ('support', 'admin', 'super_admin')
       or v_dispute.status not in ('resolved', 'closed')
       or char_length(trim(p_reason)) < 10 then
      raise exception using errcode = '42501', message = 'DISPUTE_NOT_REOPENABLE';
    end if;

    update public.job_disputes
       set status = 'reopened',
           resolved_at = null,
           version = version + 1
     where id = v_dispute.id
     returning * into v_dispute;

    update public.jobs
       set status = 'disputed',
           dispute_status = 'open'
     where id = v_dispute.job_id;
  else
    raise exception using errcode = '22023', message = 'INVALID_DISPUTE_ACTION';
  end if;

  insert into public.dispute_status_history(
    dispute_id,
    from_status,
    to_status,
    actor_user_id,
    reason
  )
  values(
    v_dispute.id,
    v_before,
    v_dispute.status,
    p_actor_profile_id,
    nullif(trim(p_reason), '')
  );

  insert into public.audit_logs(
    actor_user_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values(
    p_actor_profile_id,
    'dispute.' || p_action,
    'job_dispute',
    v_dispute.id,
    jsonb_build_object('reason', p_reason)
  );

  return v_dispute;
end;
$$;

revoke all on function public.transition_resolved_dispute(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.transition_resolved_dispute(uuid, text, uuid, text, text)
  to service_role;
