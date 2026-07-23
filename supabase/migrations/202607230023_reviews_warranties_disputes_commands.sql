-- Controlled review, warranty, claim, and dispute lifecycle commands.

create or replace function public.recalculate_professional_rating(p_professional_id uuid)
returns public.professional_rating_aggregates
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_result public.professional_rating_aggregates;
begin
  insert into public.professional_rating_aggregates (
    professional_id, published_review_count, rating_overall, rating_quality,
    rating_timeliness, rating_communication, rating_value, is_new_professional, recalculated_at
  )
  select p_professional_id, count(*)::integer,
    round(avg(rating_overall), 2), round(avg(rating_quality), 2),
    round(avg(rating_timeliness), 2), round(avg(rating_communication), 2),
    round(avg(rating_value), 2), count(*) < 3, now()
  from public.job_reviews
  where reviewee_user_id = p_professional_id and reviewer_role = 'customer' and status = 'published'
  on conflict (professional_id) do update set
    published_review_count = excluded.published_review_count,
    rating_overall = excluded.rating_overall, rating_quality = excluded.rating_quality,
    rating_timeliness = excluded.rating_timeliness, rating_communication = excluded.rating_communication,
    rating_value = excluded.rating_value, is_new_professional = excluded.is_new_professional,
    recalculated_at = excluded.recalculated_at
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.submit_job_review(
  p_actor_profile_id uuid, p_job_id uuid, p_actor_role text, p_payload jsonb
)
returns public.job_reviews
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_job public.jobs; v_review public.job_reviews; v_reviewee uuid;
begin
  if p_actor_role not in ('customer', 'professional') then raise exception using errcode='42501', message='REVIEW_ROLE_REQUIRED'; end if;
  select * into v_job from public.jobs where id = p_job_id;
  if not found or not (
    (p_actor_role='customer' and v_job.customer_id=p_actor_profile_id) or
    (p_actor_role='professional' and v_job.professional_id=p_actor_profile_id)
  ) then raise exception using errcode='P0002', message='JOB_NOT_FOUND'; end if;
  if v_job.status not in ('completed', 'warranty_active', 'closed') or v_job.cancelled_at is not null then
    raise exception using errcode='22023', message='REVIEW_NOT_ELIGIBLE';
  end if;
  v_reviewee := case when p_actor_role='customer' then v_job.professional_id else v_job.customer_id end;
  insert into public.job_reviews (
    job_id, reviewer_user_id, reviewee_user_id, reviewer_role, rating_overall,
    rating_quality, rating_timeliness, rating_communication, rating_value, comment
  ) values (
    p_job_id, p_actor_profile_id, v_reviewee, p_actor_role,
    (p_payload->>'rating_overall')::smallint, nullif(p_payload->>'rating_quality','')::smallint,
    nullif(p_payload->>'rating_timeliness','')::smallint, nullif(p_payload->>'rating_communication','')::smallint,
    nullif(p_payload->>'rating_value','')::smallint, nullif(trim(p_payload->>'comment'),'')
  ) returning * into v_review;
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('review.submitted', 'job_review', v_review.id, jsonb_build_object('job_id', p_job_id));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'review.submitted', 'job_review', v_review.id,
    jsonb_build_object('rating_overall', v_review.rating_overall, 'reviewer_role', p_actor_role));
  return v_review;
exception when unique_violation then raise exception using errcode='23505', message='REVIEW_ALREADY_SUBMITTED';
end;
$$;

create or replace function public.moderate_job_review(
  p_actor_profile_id uuid, p_actor_role text, p_review_id uuid, p_status text, p_reason text
)
returns public.job_reviews
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_review public.job_reviews;
begin
  if p_actor_role not in ('support','admin','super_admin') then raise exception using errcode='42501', message='STAFF_REQUIRED'; end if;
  if p_status not in ('published','hidden','under_review','removed') then raise exception using errcode='22023', message='INVALID_REVIEW_STATUS'; end if;
  if p_status <> 'published' and char_length(trim(p_reason)) < 5 then raise exception using errcode='22023', message='MODERATION_REASON_REQUIRED'; end if;
  update public.job_reviews set status=p_status, moderation_reason=nullif(trim(p_reason),''),
    moderated_by=p_actor_profile_id, published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end
  where id=p_review_id returning * into v_review;
  if not found then raise exception using errcode='P0002', message='REVIEW_NOT_FOUND'; end if;
  if v_review.reviewer_role='customer' then perform public.recalculate_professional_rating(v_review.reviewee_user_id); end if;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id,'review.moderated','job_review',v_review.id,jsonb_build_object('status',p_status,'reason',p_reason));
  return v_review;
end;
$$;

create or replace function public.issue_job_warranty()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_quote public.job_quotations; v_warranty public.job_warranties;
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    select * into v_quote from public.job_quotations where job_id=new.id and status='approved'
    order by version_number desc limit 1;
    if found and v_quote.warranty_days > 0 then
      insert into public.job_warranties (
        job_id, quotation_id, professional_id, customer_id, coverage_description,
        excluded_items, starts_at, expires_at, status
      ) values (
        new.id, v_quote.id, new.professional_id, new.customer_id,
        coalesce(nullif(v_quote.terms,''),'Coverage is limited to the approved quotation and completed work.'),
        v_quote.exclusions, coalesce(new.customer_completed_at,now()),
        coalesce(new.customer_completed_at,now()) + make_interval(days=>v_quote.warranty_days), 'active'
      ) on conflict (job_id) do nothing returning * into v_warranty;
      if v_warranty.id is not null then
        update public.jobs set warranty_status='active' where id=new.id;
        insert into public.domain_outbox (event_type,aggregate_type,aggregate_id,payload)
        values ('warranty.issued','job_warranty',v_warranty.id,jsonb_build_object('job_id',new.id,'expires_at',v_warranty.expires_at));
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger issue_warranty_after_completion after update of status on public.jobs
  for each row execute function public.issue_job_warranty();

create or replace function public.create_warranty_claim(
  p_actor_profile_id uuid, p_warranty_id uuid, p_description text
)
returns public.warranty_claims
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_warranty public.job_warranties; v_claim public.warranty_claims; v_hours integer:=48;
begin
  select * into v_warranty from public.job_warranties where id=p_warranty_id for update;
  if not found or v_warranty.customer_id<>p_actor_profile_id then raise exception using errcode='P0002', message='WARRANTY_NOT_FOUND'; end if;
  if v_warranty.status not in ('active','fulfilled') or v_warranty.expires_at<=now() then raise exception using errcode='22023', message='WARRANTY_NOT_CLAIMABLE'; end if;
  if char_length(trim(p_description))<10 then raise exception using errcode='22023', message='CLAIM_DESCRIPTION_REQUIRED'; end if;
  select coalesce((value #>> '{}')::integer,48) into v_hours from public.system_settings where key='warranty.professional_response_hours';
  insert into public.warranty_claims (
    warranty_id,job_id,customer_id,professional_id,description,status,professional_response_due_at
  ) values (
    v_warranty.id,v_warranty.job_id,v_warranty.customer_id,v_warranty.professional_id,trim(p_description),
    'professional_response_requested',now()+make_interval(hours=>v_hours)
  ) returning * into v_claim;
  update public.job_warranties set status='claim_open' where id=v_warranty.id;
  update public.jobs set warranty_status='claim_open' where id=v_warranty.job_id;
  insert into public.notifications(user_profile_id,channel,type,title,body)
  values(v_warranty.professional_id,'in_app','warranty_claim.submitted','Warranty response requested','A customer opened a warranty claim. Review the documented issue and respond by the shown deadline.');
  insert into public.domain_outbox(event_type,aggregate_type,aggregate_id,payload)
  values('warranty_claim.submitted','warranty_claim',v_claim.id,jsonb_build_object('job_id',v_claim.job_id));
  return v_claim;
end;
$$;

create or replace function public.respond_warranty_claim(
  p_actor_profile_id uuid, p_claim_id uuid, p_response text
)
returns public.warranty_claims
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_claim public.warranty_claims;
begin
  if char_length(trim(p_response))<5 then raise exception using errcode='22023', message='CLAIM_RESPONSE_REQUIRED'; end if;
  update public.warranty_claims set professional_response=trim(p_response),status='under_review',version=version+1
  where id=p_claim_id and professional_id=p_actor_profile_id and status='professional_response_requested'
  returning * into v_claim;
  if not found then raise exception using errcode='22023', message='CLAIM_NOT_RESPONDABLE'; end if;
  insert into public.notifications(user_profile_id,channel,type,title,body)
  values(v_claim.customer_id,'in_app','warranty_claim.responded','Warranty claim response received','The professional responded to your warranty claim.');
  return v_claim;
end;
$$;

create or replace function public.schedule_warranty_revisit(
  p_actor_profile_id uuid, p_actor_role text, p_claim_id uuid, p_scheduled_at timestamptz
)
returns public.warranty_claims
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_claim public.warranty_claims;
begin
  select * into v_claim from public.warranty_claims where id=p_claim_id for update;
  if not found or not (v_claim.professional_id=p_actor_profile_id or p_actor_role in ('support','admin','super_admin')) then
    raise exception using errcode='42501', message='CLAIM_SCHEDULE_FORBIDDEN';
  end if;
  if v_claim.status not in ('under_review','professional_response_requested') or p_scheduled_at<=now() then
    raise exception using errcode='22023', message='CLAIM_REVISIT_NOT_SCHEDULABLE';
  end if;
  update public.warranty_claims set status='revisit_scheduled',scheduled_revisit_at=p_scheduled_at,version=version+1
  where id=v_claim.id returning * into v_claim;
  insert into public.notifications(user_profile_id,channel,type,title,body)
  values(v_claim.customer_id,'in_app','warranty_claim.revisit_scheduled','Warranty revisit scheduled','A warranty revisit has been scheduled.');
  return v_claim;
end;
$$;

create or replace function public.resolve_warranty_claim(
  p_actor_profile_id uuid, p_actor_role text, p_claim_id uuid, p_resolution text, p_resolved boolean
)
returns public.warranty_claims
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_claim public.warranty_claims;
begin
  select * into v_claim from public.warranty_claims where id=p_claim_id for update;
  if not found or not (v_claim.customer_id=p_actor_profile_id or p_actor_role in ('support','admin','super_admin')) then
    raise exception using errcode='42501', message='CLAIM_RESOLUTION_FORBIDDEN';
  end if;
  if v_claim.status in ('resolved','rejected','escalated_to_dispute','cancelled') or char_length(trim(p_resolution))<5 then
    raise exception using errcode='22023', message='CLAIM_NOT_RESOLVABLE';
  end if;
  update public.warranty_claims set status=case when p_resolved then 'resolved' else 'rejected' end,
    resolution=trim(p_resolution),resolved_at=now(),version=version+1 where id=v_claim.id returning * into v_claim;
  update public.job_warranties set status=case when p_resolved then 'fulfilled' else 'active' end where id=v_claim.warranty_id;
  update public.jobs set warranty_status=case when p_resolved then 'fulfilled' else 'active' end where id=v_claim.job_id;
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(p_actor_profile_id,'warranty_claim.resolved','warranty_claim',v_claim.id,jsonb_build_object('resolved',p_resolved,'resolution',p_resolution));
  return v_claim;
end;
$$;

create or replace function public.guard_payout_against_held_earnings()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.status='paid' and old.status is distinct from 'paid' and exists (
    select 1 from public.payout_earning_items i join public.professional_earnings e on e.id=i.earning_id
    where i.payout_id=new.id and e.status='held'
  ) then raise exception using errcode='22023', message='PAYOUT_HAS_HELD_EARNINGS'; end if;
  return new;
end;
$$;
create trigger guard_payout_held_earnings before update of status on public.professional_payouts
  for each row execute function public.guard_payout_against_held_earnings();

create or replace function public.open_job_dispute(
  p_actor_profile_id uuid, p_job_id uuid, p_reason_category text, p_description text,
  p_requested_resolution text, p_contact_preference text, p_idempotency_key text, p_request_hash text
)
returns public.job_disputes
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_job public.jobs; v_dispute public.job_disputes; v_existing public.idempotency_keys;
  v_earning public.professional_earnings; v_hold_account uuid; v_payable_account uuid; v_journal uuid:=gen_random_uuid();
  v_hours integer:=48;
begin
  select * into v_existing from public.idempotency_keys where user_id=p_actor_profile_id and scope='dispute.create' and key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>p_request_hash then raise exception using errcode='23505',message='IDEMPOTENCY_CONFLICT'; end if;
    select * into v_dispute from public.job_disputes where id=(v_existing.response_body->>'dispute_id')::uuid; return v_dispute;
  end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found or p_actor_profile_id not in (v_job.customer_id,v_job.professional_id) then raise exception using errcode='P0002',message='JOB_NOT_FOUND'; end if;
  if char_length(trim(p_description))<10 or char_length(trim(p_requested_resolution))<3 then raise exception using errcode='22023',message='INVALID_DISPUTE'; end if;
  select coalesce((value #>> '{}')::integer,48) into v_hours from public.system_settings where key='disputes.default_response_hours';
  insert into public.job_disputes (
    job_id,opened_by,reason_category,description,requested_resolution,contact_preference,
    status,priority,response_due_at
  ) values (
    p_job_id,p_actor_profile_id,p_reason_category,trim(p_description),trim(p_requested_resolution),
    p_contact_preference,'open',case when p_reason_category in ('safety_concern','harassment_misconduct','property_damage') then 'high' else 'normal' end,
    now()+make_interval(hours=>v_hours)
  ) returning * into v_dispute;
  select * into v_earning from public.professional_earnings where job_id=p_job_id and status in ('pending','available','scheduled') for update;
  if found and v_earning.net_amount_minor>0 then
    update public.professional_earnings set status='held',held_reason='Active dispute '||v_dispute.dispute_reference where id=v_earning.id;
    update public.job_disputes set payment_hold_amount_minor=v_earning.net_amount_minor where id=v_dispute.id returning * into v_dispute;
    v_payable_account:=public.ensure_ledger_account('professional_payable','Professional payable','liability','professional',v_job.professional_id);
    v_hold_account:=public.ensure_ledger_account('dispute_hold','Dispute hold','liability','professional',v_job.professional_id);
    insert into public.ledger_entries(journal_id,account_id,job_id,payment_intent_id,direction,amount_minor,entry_type,description,created_by)
    values
      (v_journal,v_payable_account,p_job_id,v_earning.payment_intent_id,'debit',v_earning.net_amount_minor,'dispute_hold','Professional payable moved to dispute hold',p_actor_profile_id),
      (v_journal,v_hold_account,p_job_id,v_earning.payment_intent_id,'credit',v_earning.net_amount_minor,'dispute_hold','Active dispute hold',p_actor_profile_id);
  end if;
  update public.jobs set status='disputed',dispute_status='open',payment_status=case when payment_status='paid' then 'disputed' else payment_status end,version=version+1 where id=p_job_id;
  insert into public.dispute_status_history(dispute_id,to_status,actor_user_id,reason) values(v_dispute.id,'open',p_actor_profile_id,p_reason_category);
  insert into public.idempotency_keys(user_id,scope,key,request_hash,response_status,response_body,resource_type,resource_id)
  values(p_actor_profile_id,'dispute.create',p_idempotency_key,p_request_hash,201,jsonb_build_object('dispute_id',v_dispute.id),'job_dispute',v_dispute.id);
  insert into public.notifications(user_profile_id,channel,type,title,body)
  select id,'in_app','dispute.opened','Dispute opened','A job dispute was opened. Keep communication and evidence inside FixMate.'
  from public.user_profiles where id in (v_job.customer_id,v_job.professional_id);
  insert into public.domain_outbox(event_type,aggregate_type,aggregate_id,payload)
  values('dispute.opened','job_dispute',v_dispute.id,jsonb_build_object('job_id',p_job_id,'priority',v_dispute.priority));
  return v_dispute;
exception when unique_violation then raise exception using errcode='23505',message='ACTIVE_DISPUTE_EXISTS';
end;
$$;

create or replace function public.send_dispute_message(
  p_actor_profile_id uuid,p_actor_role text,p_dispute_id uuid,p_body text,p_visibility text
)
returns public.dispute_messages
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_dispute public.job_disputes; v_job public.jobs; v_message public.dispute_messages;
begin
  select * into v_dispute from public.job_disputes where id=p_dispute_id;
  select * into v_job from public.jobs where id=v_dispute.job_id;
  if not found or not (p_actor_profile_id in (v_job.customer_id,v_job.professional_id) or p_actor_role in ('support','admin','super_admin')) then raise exception using errcode='42501',message='DISPUTE_MESSAGE_FORBIDDEN'; end if;
  if p_actor_role in ('customer','professional') and p_visibility<>'shared' then raise exception using errcode='42501',message='DISPUTE_VISIBILITY_FORBIDDEN'; end if;
  if char_length(trim(p_body))<1 then raise exception using errcode='22023',message='INVALID_MESSAGE'; end if;
  insert into public.dispute_messages(dispute_id,sender_user_id,sender_role,body,visibility)
  values(p_dispute_id,p_actor_profile_id,p_actor_role,trim(p_body),p_visibility) returning * into v_message;
  return v_message;
end;
$$;

create or replace function public.add_resolution_evidence(
  p_actor_profile_id uuid,p_actor_role text,p_case_type text,p_case_id uuid,p_evidence_type text,
  p_storage_path text,p_mime_type text,p_file_size bigint,p_description text,p_visibility text
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_id uuid; v_job public.jobs; v_claim public.warranty_claims; v_dispute public.job_disputes;
begin
  if p_case_type='claim' then
    select * into v_claim from public.warranty_claims where id=p_case_id;
    if not found or not (p_actor_profile_id in (v_claim.customer_id,v_claim.professional_id) or p_actor_role in ('support','admin','super_admin')) then raise exception using errcode='42501',message='EVIDENCE_FORBIDDEN'; end if;
    insert into public.warranty_claim_evidence(claim_id,submitted_by,evidence_type,storage_path,mime_type,file_size,description)
    values(p_case_id,p_actor_profile_id,p_evidence_type,p_storage_path,p_mime_type,p_file_size,nullif(trim(p_description),'')) returning id into v_id;
  elsif p_case_type='dispute' then
    select * into v_dispute from public.job_disputes where id=p_case_id; select * into v_job from public.jobs where id=v_dispute.job_id;
    if not found or not (p_actor_profile_id in (v_job.customer_id,v_job.professional_id) or p_actor_role in ('support','admin','super_admin')) then raise exception using errcode='42501',message='EVIDENCE_FORBIDDEN'; end if;
    if p_actor_role in ('customer','professional') and p_visibility<>'shared' then raise exception using errcode='42501',message='DISPUTE_VISIBILITY_FORBIDDEN'; end if;
    insert into public.dispute_evidence(dispute_id,submitted_by,evidence_type,storage_path,description,visibility)
    values(p_case_id,p_actor_profile_id,p_evidence_type,p_storage_path,trim(p_description),p_visibility) returning id into v_id;
  else raise exception using errcode='22023',message='INVALID_CASE_TYPE'; end if;
  return v_id;
end;
$$;

create or replace function public.update_dispute_workflow(
  p_actor_profile_id uuid,p_actor_role text,p_dispute_id uuid,p_action text,p_value text
)
returns public.job_disputes
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_dispute public.job_disputes; v_before text;
begin
  if p_actor_role not in ('support','admin','super_admin') then raise exception using errcode='42501',message='STAFF_REQUIRED'; end if;
  select * into v_dispute from public.job_disputes where id=p_dispute_id for update;
  if not found then raise exception using errcode='P0002',message='DISPUTE_NOT_FOUND'; end if;
  v_before:=v_dispute.status;
  if p_action='assign' then
    update public.job_disputes set assigned_to=p_value::uuid,status='under_review',version=version+1 where id=p_dispute_id returning * into v_dispute;
  elsif p_action='request_customer' then
    update public.job_disputes set status='awaiting_customer',response_due_at=now()+interval '48 hours',version=version+1 where id=p_dispute_id returning * into v_dispute;
  elsif p_action='request_professional' then
    update public.job_disputes set status='awaiting_professional',response_due_at=now()+interval '48 hours',version=version+1 where id=p_dispute_id returning * into v_dispute;
  elsif p_action='propose' then
    if char_length(trim(p_value))<10 then raise exception using errcode='22023',message='RESOLUTION_SUMMARY_REQUIRED'; end if;
    update public.job_disputes set status='resolution_proposed',resolution_summary=trim(p_value),version=version+1 where id=p_dispute_id returning * into v_dispute;
  else raise exception using errcode='22023',message='INVALID_DISPUTE_ACTION'; end if;
  if v_before<>v_dispute.status then insert into public.dispute_status_history(dispute_id,from_status,to_status,actor_user_id,reason) values(v_dispute.id,v_before,v_dispute.status,p_actor_profile_id,p_action); end if;
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(p_actor_profile_id,'dispute.workflow_updated','job_dispute',v_dispute.id,jsonb_build_object('action',p_action,'value',p_value));
  return v_dispute;
end;
$$;

create or replace function public.resolve_job_dispute(
  p_actor_profile_id uuid,p_actor_role text,p_dispute_id uuid,p_decision_type text,
  p_customer_refund_minor bigint,p_professional_release_minor bigint,p_platform_fee_adjustment_minor bigint,
  p_account_target_id uuid,p_reason text
)
returns public.job_disputes
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_dispute public.job_disputes; v_job public.jobs; v_intent public.payment_intents; v_earning public.professional_earnings;
  v_refund_amount bigint:=coalesce(p_customer_refund_minor,0); v_refunded bigint:=0;
  v_hold_account uuid; v_payable_account uuid; v_journal uuid:=gen_random_uuid(); v_release bigint;
begin
  if p_actor_role not in ('admin','super_admin') then raise exception using errcode='42501',message='ADMIN_REQUIRED'; end if;
  if char_length(trim(p_reason))<10 then raise exception using errcode='22023',message='DISPUTE_DECISION_REASON_REQUIRED'; end if;
  select * into v_dispute from public.job_disputes where id=p_dispute_id for update;
  if not found then raise exception using errcode='P0002',message='DISPUTE_NOT_FOUND'; end if;
  if v_dispute.status in ('resolved','rejected','closed') then raise exception using errcode='22023',message='DISPUTE_NOT_RESOLVABLE'; end if;
  select * into v_job from public.jobs where id=v_dispute.job_id for update;
  select * into v_intent from public.payment_intents where job_id=v_job.id and status in ('cash_confirmed','paid','partially_refunded','refunded') order by created_at desc limit 1 for update;
  if p_decision_type='full_refund' and v_intent.id is not null then
    select coalesce(sum(amount_minor),0) into v_refunded from public.refunds where payment_intent_id=v_intent.id and status in ('approved','processing','completed');
    v_refund_amount:=greatest(0,v_intent.amount_minor-v_refunded);
  end if;
  if v_refund_amount>0 then
    if v_intent.id is null or v_refund_amount>v_intent.amount_minor then raise exception using errcode='22023',message='INVALID_DISPUTE_REFUND'; end if;
    insert into public.refunds(job_id,payment_intent_id,dispute_id,currency_code,amount_minor,reason,provider,status,requested_by,approved_by,idempotency_key)
    values(v_job.id,v_intent.id,v_dispute.id,v_intent.currency_code,v_refund_amount,'Dispute decision: '||trim(p_reason),v_intent.provider,'approved',p_actor_profile_id,p_actor_profile_id,'dispute:'||v_dispute.id);
  end if;
  select * into v_earning from public.professional_earnings where job_id=v_job.id for update;
  if found and v_earning.status='held' and v_dispute.payment_hold_amount_minor>0 then
    v_release:=least(v_dispute.payment_hold_amount_minor,greatest(0,coalesce(p_professional_release_minor,v_dispute.payment_hold_amount_minor-v_refund_amount)));
    if v_release>0 then
      v_payable_account:=public.ensure_ledger_account('professional_payable','Professional payable','liability','professional',v_job.professional_id);
      v_hold_account:=public.ensure_ledger_account('dispute_hold','Dispute hold','liability','professional',v_job.professional_id);
      insert into public.ledger_entries(journal_id,account_id,job_id,payment_intent_id,direction,amount_minor,entry_type,description,created_by)
      values
        (v_journal,v_hold_account,v_job.id,v_earning.payment_intent_id,'debit',v_release,'dispute_hold','Dispute hold released',p_actor_profile_id),
        (v_journal,v_payable_account,v_job.id,v_earning.payment_intent_id,'credit',v_release,'professional_payable','Professional payable released by dispute decision',p_actor_profile_id);
    end if;
    update public.professional_earnings set
      status=case when exists(select 1 from public.payout_earning_items i join public.professional_payouts p on p.id=i.payout_id where i.earning_id=v_earning.id and p.status='scheduled') then 'scheduled' else 'available' end,
      held_reason=null,adjustment_minor=adjustment_minor+p_platform_fee_adjustment_minor,
      net_amount_minor=greatest(0,net_amount_minor+p_platform_fee_adjustment_minor)
    where id=v_earning.id;
  end if;
  if p_decision_type in ('account_warning','suspension','permanent_restriction','external_referral') then
    if p_account_target_id not in (v_job.customer_id,v_job.professional_id) then raise exception using errcode='22023',message='INVALID_ACCOUNT_ACTION_TARGET'; end if;
    insert into public.marketplace_account_actions(dispute_id,target_user_id,action_type,reason,applied_by)
    values(v_dispute.id,p_account_target_id,
      case p_decision_type when 'account_warning' then 'warning' when 'suspension' then 'suspension' when 'permanent_restriction' then 'permanent_restriction' else 'external_referral' end,
      trim(p_reason),p_actor_profile_id);
    if p_decision_type='suspension' then update public.user_profiles set account_status='suspended',suspension_reason=trim(p_reason) where id=p_account_target_id;
    elsif p_decision_type='permanent_restriction' then update public.user_profiles set account_status='disabled' where id=p_account_target_id; end if;
  end if;
  insert into public.dispute_decisions(dispute_id,decided_by,decision_type,customer_refund_minor,professional_release_minor,platform_fee_adjustment_minor,account_action,reason)
  values(v_dispute.id,p_actor_profile_id,p_decision_type,v_refund_amount,coalesce(p_professional_release_minor,0),coalesce(p_platform_fee_adjustment_minor,0),
    case when p_decision_type in ('account_warning','suspension','permanent_restriction','external_referral') then p_decision_type else null end,trim(p_reason));
  update public.job_disputes set status='resolved',resolved_at=now(),resolution_type=p_decision_type,resolution_summary=trim(p_reason),version=version+1
  where id=v_dispute.id returning * into v_dispute;
  update public.jobs set status='completed',dispute_status='resolved',
    payment_status=case when v_intent.status='refunded' then 'refunded' when v_intent.status='partially_refunded' then 'partially_refunded' when v_intent.id is not null then 'paid' else payment_status end,
    version=version+1 where id=v_job.id;
  insert into public.dispute_status_history(dispute_id,from_status,to_status,actor_user_id,reason)
  values(v_dispute.id,'under_review','resolved',p_actor_profile_id,trim(p_reason));
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(p_actor_profile_id,'dispute.resolved','job_dispute',v_dispute.id,jsonb_build_object('decision_type',p_decision_type,'refund_minor',v_refund_amount,'reason',p_reason));
  insert into public.notifications(user_profile_id,channel,type,title,body)
  select id,'in_app','dispute.resolved','Dispute decision recorded','FixMate recorded a dispute decision. Review the case timeline for the approved outcome.'
  from public.user_profiles where id in (v_job.customer_id,v_job.professional_id);
  insert into public.domain_outbox(event_type,aggregate_type,aggregate_id,payload)
  values('dispute.resolved','job_dispute',v_dispute.id,jsonb_build_object('decision_type',p_decision_type,'refund_minor',v_refund_amount));
  return v_dispute;
end;
$$;

create or replace function public.transition_resolved_dispute(
  p_actor_profile_id uuid,p_actor_role text,p_dispute_id uuid,p_action text,p_reason text
)
returns public.job_disputes
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_dispute public.job_disputes; v_before text;
begin
  select * into v_dispute from public.job_disputes where id=p_dispute_id for update;
  if not found then raise exception using errcode='P0002',message='DISPUTE_NOT_FOUND'; end if;
  v_before:=v_dispute.status;
  if p_action='close' then
    if v_dispute.status<>'resolved' then raise exception using errcode='22023',message='DISPUTE_NOT_CLOSABLE'; end if;
    update public.job_disputes set status='closed',version=version+1 where id=v_dispute.id returning * into v_dispute;
    update public.jobs set dispute_status='closed' where id=v_dispute.job_id;
  elsif p_action='reopen' then
    if p_actor_role not in ('support','admin','super_admin') or v_dispute.status not in ('resolved','closed') or char_length(trim(p_reason))<10 then
      raise exception using errcode='42501',message='DISPUTE_NOT_REOPENABLE';
    end if;
    update public.job_disputes set status='reopened',resolved_at=null,version=version+1 where id=v_dispute.id returning * into v_dispute;
    update public.jobs set status='disputed',dispute_status='open' where id=v_dispute.job_id;
  else raise exception using errcode='22023',message='INVALID_DISPUTE_ACTION'; end if;
  insert into public.dispute_status_history(dispute_id,from_status,to_status,actor_user_id,reason)
  values(v_dispute.id,v_before,v_dispute.status,p_actor_profile_id,nullif(trim(p_reason),''));
  insert into public.audit_logs(actor_user_profile_id,action,entity_type,entity_id,after_data)
  values(p_actor_profile_id,'dispute.'||p_action,'job_dispute',v_dispute.id,jsonb_build_object('reason',p_reason));
  return v_dispute;
end;
$$;

do $$
declare signature text;
begin
  foreach signature in array array[
    'recalculate_professional_rating(uuid)',
    'submit_job_review(uuid,uuid,text,jsonb)',
    'moderate_job_review(uuid,text,uuid,text,text)',
    'create_warranty_claim(uuid,uuid,text)',
    'respond_warranty_claim(uuid,uuid,text)',
    'schedule_warranty_revisit(uuid,text,uuid,timestamp with time zone)',
    'resolve_warranty_claim(uuid,text,uuid,text,boolean)',
    'open_job_dispute(uuid,uuid,text,text,text,text,text,text)',
    'send_dispute_message(uuid,text,uuid,text,text)',
    'add_resolution_evidence(uuid,text,text,uuid,text,text,text,bigint,text,text)',
    'update_dispute_workflow(uuid,text,uuid,text,text)',
    'resolve_job_dispute(uuid,text,uuid,text,bigint,bigint,bigint,uuid,text)',
    'transition_resolved_dispute(uuid,text,uuid,text,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated',signature);
    execute format('grant execute on function public.%s to service_role',signature);
  end loop;
end $$;
