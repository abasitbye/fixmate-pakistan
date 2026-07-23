-- Deterministic matching, professional offer commands, and atomic acceptance.

insert into public.system_settings (key, value, is_public, description)
values
  ('phase2.matching.batch_size', '5'::jsonb, false, 'Default professionals invited per matching batch.'),
  ('phase2.matching.invitation_minutes', '60'::jsonb, false, 'Default professional invitation validity.')
on conflict (key) do nothing;

create or replace function public.run_request_matching(
  p_request_id uuid,
  p_actor_profile_id uuid,
  p_batch_size integer default 5,
  p_strategy_version text default 'zone-availability-fairness-v1'
)
returns public.matching_runs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests;
  v_run public.matching_runs;
  v_invited integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 20 then
    raise exception using errcode = '22023', message = 'INVALID_BATCH_SIZE';
  end if;
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'system', true);

  select * into v_request from public.service_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND'; end if;
  if v_request.status not in ('submitted', 'matching', 'no_match') then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_MATCHABLE';
  end if;
  if v_request.expires_at is not null and v_request.expires_at <= now() then
    update public.service_requests set status = 'expired', matching_status = 'exhausted', version = version + 1
    where id = p_request_id;
    raise exception using errcode = '22023', message = 'REQUEST_EXPIRED';
  end if;

  update public.service_requests set
    status = 'matching',
    matching_status = 'running',
    version = version + 1
  where id = p_request_id and status <> 'matching';

  insert into public.matching_runs (request_id, strategy_version, started_at, status)
  values (p_request_id, p_strategy_version, now(), 'running')
  returning * into v_run;

  with eligible as (
    select
      pp.user_profile_id as professional_id,
      100::numeric as service_score,
      100::numeric as availability_score,
      50::numeric as quality_score,
      greatest(
        20,
        100 - (
          select count(*)::integer * 10
          from public.bookings b
          where b.professional_id = pp.user_profile_id
            and b.status in ('pending_confirmation', 'confirmed', 'rescheduled', 'converted_to_job')
            and b.scheduled_start_at >= now() - interval '30 days'
        )
      )::numeric as fairness_score
    from public.professional_profiles pp
    join public.user_profiles up on up.id = pp.user_profile_id
    where pp.application_status = 'approved'
      and up.account_status = 'active'
      and exists (
        select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id
        where ur.user_profile_id = pp.user_profile_id and ur.is_active and r.code = 'professional'
      )
      and exists (
        select 1 from public.professional_services ps
        where ps.professional_profile_id = pp.user_profile_id
          and ps.service_subcategory_id = v_request.service_subcategory_id and ps.is_active
      )
      and (
        v_request.service_zone_id is null
        or exists (
          select 1 from public.professional_service_areas psa
          where psa.professional_profile_id = pp.user_profile_id
            and psa.service_zone_id = v_request.service_zone_id and psa.is_active
        )
      )
      and not exists (
        select 1 from public.verification_types vt
        where vt.is_required and vt.is_active
          and not exists (
            select 1 from public.professional_verifications pv
            where pv.professional_profile_id = pp.user_profile_id
              and pv.verification_type_id = vt.id
              and pv.status = 'verified'
              and (pv.expires_at is null or pv.expires_at > now())
          )
      )
      and (
        v_request.preferred_date is null
        or v_request.preferred_start_time is null
        or exists (
          select 1 from public.professional_availability_schedules pas
          where pas.professional_profile_id = pp.user_profile_id and pas.is_active
            and pas.day_of_week = extract(dow from v_request.preferred_date)::integer
            and pas.start_time <= v_request.preferred_start_time
            and pas.end_time >= coalesce(v_request.preferred_end_time, v_request.preferred_start_time + interval '1 hour')
        )
      )
      and not exists (
        select 1 from public.bookings b
        where b.professional_id = pp.user_profile_id
          and b.status in ('pending_confirmation', 'confirmed', 'rescheduled', 'converted_to_job')
          and v_request.preferred_date is not null
          and v_request.preferred_start_time is not null
          and b.scheduled_start_at < (
            (v_request.preferred_date + coalesce(v_request.preferred_end_time, v_request.preferred_start_time + interval '1 hour'))
            at time zone 'Asia/Karachi'
          )
          and b.scheduled_end_at > (
            (v_request.preferred_date + v_request.preferred_start_time) at time zone 'Asia/Karachi'
          )
      )
      and not exists (
        select 1 from public.request_matching_candidates previous
        where previous.request_id = p_request_id
          and previous.professional_id = pp.user_profile_id
          and previous.invitation_status not in ('failed', 'expired')
      )
  ),
  ranked as (
    select *,
      (service_score * .40 + availability_score * .25 + quality_score * .15 + fairness_score * .20) as ranking_score,
      row_number() over (
        order by (service_score * .40 + availability_score * .25 + quality_score * .15 + fairness_score * .20) desc,
          professional_id
      ) as rank_position
    from eligible
  )
  insert into public.request_matching_candidates (
    matching_run_id, request_id, professional_id, eligibility_status, eligibility_reasons,
    service_score, availability_score, quality_score, fairness_score, ranking_score,
    rank_position, invitation_status, invited_at, expires_at
  )
  select
    v_run.id, p_request_id, professional_id, 'eligible', '[]'::jsonb,
    service_score, availability_score, quality_score, fairness_score, ranking_score,
    rank_position, 'sent', now(), now() + interval '60 minutes'
  from ranked
  where rank_position <= p_batch_size;

  get diagnostics v_invited = row_count;

  update public.matching_runs set
    status = 'completed',
    completed_at = now(),
    candidate_count = v_invited,
    invited_count = v_invited
  where id = v_run.id
  returning * into v_run;

  if v_invited = 0 then
    update public.service_requests set status = 'no_match', matching_status = 'exhausted', version = version + 1
    where id = p_request_id;
    insert into public.notifications (user_profile_id, channel, type, title, body, data)
    values (
      v_request.customer_id, 'in_app', 'service_request.no_match',
      'No suitable professional found yet',
      'You can adjust the schedule, contact support, or try matching again later.',
      jsonb_build_object('requestId', p_request_id, 'deepLink', '/customer/requests/' || p_request_id::text)
    );
  else
    insert into public.notifications (user_profile_id, channel, type, title, body, data)
    select
      candidate.professional_id, 'in_app', 'professional.invitation',
      'New FixMate service invitation',
      'A service request matching your approved skills and area is available.',
      jsonb_build_object(
        'requestId', p_request_id,
        'invitationId', candidate.id,
        'deepLink', '/professional/requests/' || candidate.id::text
      )
    from public.request_matching_candidates candidate
    where candidate.matching_run_id = v_run.id;
  end if;

  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    case when v_invited = 0 then 'matching.no_match' else 'matching.batch_completed' end,
    'service_request', p_request_id,
    jsonb_build_object('matchingRunId', v_run.id, 'invitedCount', v_invited, 'strategyVersion', p_strategy_version)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'matching.run', 'matching_run', v_run.id::text,
    jsonb_build_object('requestId', p_request_id, 'invitedCount', v_invited, 'strategyVersion', p_strategy_version)
  );
  return v_run;
end;
$$;

create or replace function public.save_professional_offer(
  p_actor_profile_id uuid,
  p_request_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_payload jsonb
)
returns public.professional_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.service_requests;
  v_offer public.professional_offers;
  v_total bigint;
  v_item_total bigint;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);

  select * into v_request from public.service_requests where id = p_request_id for share;
  if not found or v_request.status not in ('matching', 'offers_received') then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_OFFERABLE';
  end if;
  if not exists (
    select 1 from public.request_matching_candidates c
    where c.request_id = p_request_id and c.professional_id = p_actor_profile_id
      and c.invitation_status in ('sent', 'delivered', 'viewed', 'offer_submitted')
      and c.expires_at > now()
  ) then raise exception using errcode = '42501', message = 'INVITATION_NOT_AVAILABLE'; end if;
  if not exists (
    select 1 from public.professional_profiles pp
    join public.user_profiles up on up.id = pp.user_profile_id
    where pp.user_profile_id = p_actor_profile_id
      and pp.application_status = 'approved' and up.account_status = 'active'
  ) then raise exception using errcode = '42501', message = 'PROFESSIONAL_NOT_ELIGIBLE'; end if;

  select coalesce(sum(
    round((item ->> 'quantity')::numeric * (item ->> 'unit_price_minor')::bigint)
  ), 0)::bigint into v_item_total
  from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) item;
  v_total := greatest(
    v_item_total,
    coalesce((p_payload ->> 'callout_fee_minor')::bigint, 0)
      + coalesce((p_payload ->> 'labor_amount_minor')::bigint, 0)
      + coalesce((p_payload ->> 'material_estimate_minor')::bigint, 0)
      + coalesce((p_payload ->> 'inspection_fee_minor')::bigint, 0)
  );
  if v_total < 0 then raise exception using errcode = '22023', message = 'INVALID_OFFER_TOTAL'; end if;

  if p_offer_id is null then
    insert into public.professional_offers (
      request_id, professional_id, offer_type, callout_fee_minor, labor_amount_minor,
      material_estimate_minor, minimum_amount_minor, maximum_amount_minor,
      total_amount_minor, inspection_fee_minor, message, estimated_duration_minutes,
      proposed_start_at, proposed_end_at, requires_inspection, includes_materials,
      warranty_days, valid_until
    ) values (
      p_request_id, p_actor_profile_id, p_payload ->> 'offer_type',
      coalesce((p_payload ->> 'callout_fee_minor')::bigint, 0),
      coalesce((p_payload ->> 'labor_amount_minor')::bigint, 0),
      coalesce((p_payload ->> 'material_estimate_minor')::bigint, 0),
      nullif(p_payload ->> 'minimum_amount_minor', '')::bigint,
      nullif(p_payload ->> 'maximum_amount_minor', '')::bigint,
      v_total,
      coalesce((p_payload ->> 'inspection_fee_minor')::bigint, 0),
      p_payload ->> 'message',
      (p_payload ->> 'estimated_duration_minutes')::integer,
      (p_payload ->> 'proposed_start_at')::timestamptz,
      (p_payload ->> 'proposed_end_at')::timestamptz,
      (p_payload ->> 'offer_type') = 'inspection_required',
      coalesce((p_payload ->> 'includes_materials')::boolean, false),
      coalesce((p_payload ->> 'warranty_days')::integer, 0),
      (p_payload ->> 'valid_until')::timestamptz
    ) returning * into v_offer;
  else
    select * into v_offer from public.professional_offers
    where id = p_offer_id and professional_id = p_actor_profile_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'OFFER_NOT_FOUND'; end if;
    if v_offer.status <> 'draft' then raise exception using errcode = '22023', message = 'OFFER_NOT_EDITABLE'; end if;
    if v_offer.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
    update public.professional_offers set
      offer_type = p_payload ->> 'offer_type',
      callout_fee_minor = coalesce((p_payload ->> 'callout_fee_minor')::bigint, 0),
      labor_amount_minor = coalesce((p_payload ->> 'labor_amount_minor')::bigint, 0),
      material_estimate_minor = coalesce((p_payload ->> 'material_estimate_minor')::bigint, 0),
      minimum_amount_minor = nullif(p_payload ->> 'minimum_amount_minor', '')::bigint,
      maximum_amount_minor = nullif(p_payload ->> 'maximum_amount_minor', '')::bigint,
      total_amount_minor = v_total,
      inspection_fee_minor = coalesce((p_payload ->> 'inspection_fee_minor')::bigint, 0),
      message = p_payload ->> 'message',
      estimated_duration_minutes = (p_payload ->> 'estimated_duration_minutes')::integer,
      proposed_start_at = (p_payload ->> 'proposed_start_at')::timestamptz,
      proposed_end_at = (p_payload ->> 'proposed_end_at')::timestamptz,
      requires_inspection = (p_payload ->> 'offer_type') = 'inspection_required',
      includes_materials = coalesce((p_payload ->> 'includes_materials')::boolean, false),
      warranty_days = coalesce((p_payload ->> 'warranty_days')::integer, 0),
      valid_until = (p_payload ->> 'valid_until')::timestamptz,
      version = version + 1
    where id = p_offer_id returning * into v_offer;
    delete from public.professional_offer_items where offer_id = p_offer_id;
  end if;

  insert into public.professional_offer_items (
    offer_id, item_type, description, quantity, unit, unit_price_minor, amount_minor, display_order
  )
  select
    v_offer.id,
    item ->> 'item_type',
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    item ->> 'unit',
    (item ->> 'unit_price_minor')::bigint,
    round((item ->> 'quantity')::numeric * (item ->> 'unit_price_minor')::bigint)::bigint,
    ordinality::integer
  from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) with ordinality as entry(item, ordinality);

  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'professional_offer.save_draft', 'professional_offer',
    v_offer.id::text, jsonb_build_object('requestId', p_request_id, 'version', v_offer.version)
  );
  return v_offer;
end;
$$;

create or replace function public.submit_professional_offer(
  p_actor_profile_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns public.professional_offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_offer public.professional_offers;
  v_customer_id uuid;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'offer.submit' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_offer from public.professional_offers where id = v_existing.resource_id;
    return v_offer;
  end if;

  select * into v_offer from public.professional_offers
  where id = p_offer_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'OFFER_NOT_FOUND'; end if;
  if v_offer.status <> 'draft' then raise exception using errcode = '22023', message = 'OFFER_NOT_SUBMITTABLE'; end if;
  if v_offer.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if v_offer.valid_until <= now() or v_offer.proposed_start_at <= now() then
    raise exception using errcode = '22023', message = 'OFFER_SCHEDULE_EXPIRED';
  end if;
  if v_offer.offer_type = 'fixed_price' and v_offer.total_amount_minor is null then
    raise exception using errcode = '22023', message = 'INVALID_OFFER_TOTAL';
  end if;
  if v_offer.offer_type = 'estimated_range' and (
    v_offer.minimum_amount_minor is null or v_offer.maximum_amount_minor is null
    or v_offer.minimum_amount_minor > v_offer.maximum_amount_minor
  ) then raise exception using errcode = '22023', message = 'INVALID_OFFER_RANGE'; end if;

  update public.professional_offers set
    status = 'submitted', submitted_at = now(), version = version + 1
  where id = p_offer_id returning * into v_offer;
  update public.request_matching_candidates set invitation_status = 'offer_submitted', responded_at = now()
  where request_id = v_offer.request_id and professional_id = p_actor_profile_id
    and invitation_status in ('sent', 'delivered', 'viewed');
  update public.matching_runs set offer_count = offer_count + 1
  where id = (
    select matching_run_id from public.request_matching_candidates
    where request_id = v_offer.request_id and professional_id = p_actor_profile_id
    order by created_at desc limit 1
  );
  update public.service_requests set
    status = 'offers_received', matching_status = 'offers_available', version = version + 1
  where id = v_offer.request_id and status = 'matching'
  returning customer_id into v_customer_id;
  if v_customer_id is null then
    select customer_id into v_customer_id from public.service_requests where id = v_offer.request_id;
  end if;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'offer.submit', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('offerId', p_offer_id), 'professional_offer', p_offer_id, now() + interval '24 hours'
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    v_customer_id, 'in_app', 'professional_offer.submitted', 'A professional sent an offer',
    'Review the price, schedule, included work, and warranty before choosing.',
    jsonb_build_object('requestId', v_offer.request_id, 'offerId', p_offer_id, 'deepLink', '/customer/requests/' || v_offer.request_id::text || '/offers')
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'professional_offer.submitted', 'professional_offer', p_offer_id,
    jsonb_build_object('requestId', v_offer.request_id, 'professionalId', p_actor_profile_id, 'customerId', v_customer_id)
  );
  return v_offer;
end;
$$;

create or replace function public.withdraw_professional_offer(
  p_actor_profile_id uuid,
  p_offer_id uuid,
  p_expected_version integer,
  p_reason text
)
returns public.professional_offers
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer public.professional_offers;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'professional', true);
  select * into v_offer from public.professional_offers
  where id = p_offer_id and professional_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'OFFER_NOT_FOUND'; end if;
  if v_offer.status not in ('draft', 'submitted') then raise exception using errcode = '22023', message = 'OFFER_NOT_WITHDRAWABLE'; end if;
  if v_offer.version <> p_expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  update public.professional_offers set
    status = 'withdrawn', withdrawn_at = now(), withdrawal_reason = trim(p_reason), version = version + 1
  where id = p_offer_id returning * into v_offer;
  update public.request_matching_candidates set invitation_status = 'withdrawn', responded_at = now()
  where request_id = v_offer.request_id and professional_id = p_actor_profile_id;
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('professional_offer.withdrawn', 'professional_offer', p_offer_id, jsonb_build_object('requestId', v_offer.request_id));
  return v_offer;
end;
$$;

create or replace function public.accept_professional_offer(
  p_actor_profile_id uuid,
  p_request_id uuid,
  p_offer_id uuid,
  p_offer_version integer,
  p_request_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.idempotency_keys;
  v_request public.service_requests;
  v_offer public.professional_offers;
  v_snapshot public.accepted_offer_snapshots;
  v_booking public.bookings;
  v_terms jsonb;
begin
  perform set_config('app.actor_profile_id', p_actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);
  select * into v_existing from public.idempotency_keys
  where user_id = p_actor_profile_id and scope = 'offer.accept' and key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT'; end if;
    select * into v_booking from public.bookings where id = v_existing.resource_id;
    return v_booking;
  end if;

  select * into v_request from public.service_requests
  where id = p_request_id and customer_id = p_actor_profile_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'offers_received' or v_request.selected_offer_id is not null then
    raise exception using errcode = '22023', message = 'OFFER_ALREADY_SELECTED';
  end if;
  if v_request.version <> p_request_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;

  select * into v_offer from public.professional_offers
  where id = p_offer_id and request_id = p_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'OFFER_NOT_FOUND'; end if;
  if v_offer.status <> 'submitted' or v_offer.valid_until <= now() then
    raise exception using errcode = '22023', message = 'OFFER_NOT_ACCEPTABLE';
  end if;
  if v_offer.version <> p_offer_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if not exists (
    select 1 from public.professional_profiles pp join public.user_profiles up on up.id = pp.user_profile_id
    where pp.user_profile_id = v_offer.professional_id
      and pp.application_status = 'approved' and up.account_status = 'active'
  ) then raise exception using errcode = '42501', message = 'PROFESSIONAL_NOT_ELIGIBLE'; end if;
  if exists (
    select 1 from public.bookings b
    where b.professional_id = v_offer.professional_id
      and b.status in ('pending_confirmation', 'confirmed', 'rescheduled', 'converted_to_job')
      and b.scheduled_start_at < v_offer.proposed_end_at
      and b.scheduled_end_at > v_offer.proposed_start_at
  ) then raise exception using errcode = '22023', message = 'PROFESSIONAL_SCHEDULE_CONFLICT'; end if;

  v_terms := jsonb_build_object(
    'offerReference', v_offer.offer_reference,
    'offerType', v_offer.offer_type,
    'currencyCode', v_offer.currency_code,
    'calloutFeeMinor', v_offer.callout_fee_minor,
    'laborAmountMinor', v_offer.labor_amount_minor,
    'materialEstimateMinor', v_offer.material_estimate_minor,
    'minimumAmountMinor', v_offer.minimum_amount_minor,
    'maximumAmountMinor', v_offer.maximum_amount_minor,
    'totalAmountMinor', v_offer.total_amount_minor,
    'inspectionFeeMinor', v_offer.inspection_fee_minor,
    'message', v_offer.message,
    'estimatedDurationMinutes', v_offer.estimated_duration_minutes,
    'proposedStartAt', v_offer.proposed_start_at,
    'proposedEndAt', v_offer.proposed_end_at,
    'includesMaterials', v_offer.includes_materials,
    'warrantyDays', v_offer.warranty_days,
    'items', (
      select coalesce(jsonb_agg(to_jsonb(i) - 'offer_id' order by i.display_order), '[]'::jsonb)
      from public.professional_offer_items i where i.offer_id = v_offer.id
    )
  );
  insert into public.accepted_offer_snapshots (
    request_id, offer_id, customer_id, professional_id, commercial_terms, terms_hash
  ) values (
    p_request_id, p_offer_id, p_actor_profile_id, v_offer.professional_id,
    v_terms, encode(extensions.digest(v_terms::text, 'sha256'), 'hex')
  ) returning * into v_snapshot;

  update public.professional_offers set status = 'accepted', accepted_at = now(), version = version + 1
  where id = p_offer_id returning * into v_offer;
  update public.professional_offers set status = 'rejected', rejected_at = now(), version = version + 1
  where request_id = p_request_id and id <> p_offer_id and status = 'submitted';
  update public.request_matching_candidates set
    invitation_status = case when professional_id = v_offer.professional_id then 'offer_submitted'::public.invitation_status else 'withdrawn'::public.invitation_status end,
    responded_at = coalesce(responded_at, now())
  where request_id = p_request_id and invitation_status not in ('declined', 'expired', 'failed');

  update public.service_requests set
    status = 'professional_selected', selected_offer_id = p_offer_id, matching_status = 'completed', version = version + 1
  where id = p_request_id;
  update public.service_requests set status = 'converted_to_booking', version = version + 1
  where id = p_request_id returning * into v_request;

  insert into public.bookings (
    request_id, accepted_offer_id, accepted_offer_snapshot_id, customer_id,
    professional_id, property_id, scheduled_start_at, scheduled_end_at
  ) values (
    p_request_id, p_offer_id, v_snapshot.id, p_actor_profile_id,
    v_offer.professional_id, v_request.property_id, v_offer.proposed_start_at, v_offer.proposed_end_at
  ) returning * into v_booking;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    p_actor_profile_id, 'offer.accept', p_idempotency_key, p_request_hash, 200,
    jsonb_build_object('bookingId', v_booking.id), 'booking', v_booking.id, now() + interval '24 hours'
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values
    (
      p_actor_profile_id, 'in_app', 'professional_offer.accepted',
      'Professional selected', 'Your booking is waiting for professional confirmation.',
      jsonb_build_object('requestId', p_request_id, 'bookingId', v_booking.id, 'deepLink', '/customer/bookings/' || v_booking.id::text)
    ),
    (
      v_offer.professional_id, 'in_app', 'professional_offer.accepted',
      'Your offer was accepted', 'Confirm the booking within the required window.',
      jsonb_build_object('requestId', p_request_id, 'bookingId', v_booking.id, 'deepLink', '/professional/bookings/' || v_booking.id::text)
    );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'professional_offer.accepted', 'booking', v_booking.id,
    jsonb_build_object('requestId', p_request_id, 'offerId', p_offer_id, 'customerId', p_actor_profile_id, 'professionalId', v_offer.professional_id)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    p_actor_profile_id, 'professional_offer.accept', 'booking', v_booking.id::text,
    jsonb_build_object('requestId', p_request_id, 'offerId', p_offer_id, 'snapshotId', v_snapshot.id)
  );
  return v_booking;
end;
$$;

revoke all on function public.run_request_matching(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.save_professional_offer(uuid, uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.submit_professional_offer(uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.withdraw_professional_offer(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.accept_professional_offer(uuid, uuid, uuid, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.run_request_matching(uuid, uuid, integer, text) to service_role;
grant execute on function public.save_professional_offer(uuid, uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.submit_professional_offer(uuid, uuid, integer, text, text) to service_role;
grant execute on function public.withdraw_professional_offer(uuid, uuid, integer, text) to service_role;
grant execute on function public.accept_professional_offer(uuid, uuid, uuid, integer, integer, text, text) to service_role;
