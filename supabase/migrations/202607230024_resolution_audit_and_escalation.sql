-- Ensure warranty/claim issuance and every claim status transition is observable,
-- and provide an atomic warranty-claim escalation into the dispute workflow.

create or replace function public.record_resolution_lifecycle_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_action text; v_entity text; v_id uuid; v_actor uuid; v_status text;
begin
  if tg_table_name='job_warranties' then
    v_action:='warranty.issued';v_entity:='job_warranty';v_id:=new.id;v_status:=new.status;
  elsif tg_table_name='warranty_claims' then
    if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
    v_action:=case when tg_op='INSERT' then 'warranty_claim.created' else 'warranty_claim.status_changed' end;
    v_entity:='warranty_claim';v_id:=new.id;v_actor:=case when tg_op='INSERT' then new.customer_id else null end;v_status:=new.status;
  else
    v_action:='dispute.opened';v_entity:='job_dispute';v_id:=new.id;v_actor:=new.opened_by;v_status:=new.status;
  end if;
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(v_actor,v_action,v_entity,v_id,jsonb_build_object('status',v_status));
  if tg_table_name='warranty_claims' then
    insert into public.domain_outbox(event_type,aggregate_type,aggregate_id,payload)
    values(v_action,v_entity,v_id,jsonb_build_object('status',v_status,'job_id',new.job_id));
  end if;
  return new;
end;
$$;

create trigger audit_warranty_issued after insert on public.job_warranties
  for each row execute function public.record_resolution_lifecycle_audit();
create trigger audit_warranty_claim_lifecycle after insert or update of status on public.warranty_claims
  for each row execute function public.record_resolution_lifecycle_audit();
create trigger audit_dispute_opened after insert on public.job_disputes
  for each row execute function public.record_resolution_lifecycle_audit();

create or replace function public.escalate_warranty_claim(
  p_actor_profile_id uuid,
  p_claim_id uuid,
  p_requested_resolution text,
  p_idempotency_key text,
  p_request_hash text
)
returns public.job_disputes
language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_claim public.warranty_claims; v_dispute public.job_disputes;
begin
  select * into v_claim from public.warranty_claims where id=p_claim_id for update;
  if not found or v_claim.customer_id<>p_actor_profile_id then raise exception using errcode='P0002',message='CLAIM_NOT_FOUND'; end if;
  if v_claim.status in ('resolved','rejected','escalated_to_dispute','cancelled') then raise exception using errcode='22023',message='CLAIM_NOT_ESCALATABLE'; end if;
  v_dispute:=public.open_job_dispute(
    p_actor_profile_id,v_claim.job_id,'warranty_failure',
    'Warranty claim '||v_claim.claim_reference||' could not be resolved: '||v_claim.description,
    p_requested_resolution,'in_app',p_idempotency_key,p_request_hash
  );
  update public.warranty_claims set status='escalated_to_dispute',resolution='Escalated to '||v_dispute.dispute_reference,
    resolved_at=now(),version=version+1 where id=v_claim.id;
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(p_actor_profile_id,'warranty_claim.escalated','warranty_claim',v_claim.id,jsonb_build_object('dispute_id',v_dispute.id));
  return v_dispute;
end;
$$;
revoke all on function public.escalate_warranty_claim(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.escalate_warranty_claim(uuid,uuid,text,text,text) to service_role;
