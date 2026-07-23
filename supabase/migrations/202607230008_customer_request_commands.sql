-- Atomic customer request commands. Callable only by the trusted service role.

create or replace function public.record_service_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := coalesce(
    public.current_profile_id(),
    nullif(current_setting('app.actor_profile_id', true), '')::uuid
  );
  actor_role text := coalesce(nullif(current_setting('app.actor_role', true), ''), 'system');
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.service_request_status_history (
      request_id, from_status, to_status, actor_user_id, actor_role
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      actor_id,
      actor_role
    );
  end if;
  return new;
end;
$$;

create or replace function public.create_service_request_draft(
  actor_profile_id uuid,
  command_payload jsonb,
  caller_idempotency_key text,
  caller_request_hash text
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_key public.idempotency_keys;
  property_record public.properties;
  created_request public.service_requests;
  category_id uuid := (command_payload ->> 'service_category_id')::uuid;
  subcategory_id uuid := (command_payload ->> 'service_subcategory_id')::uuid;
begin
  perform set_config('app.actor_profile_id', actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);

  select * into existing_key
  from public.idempotency_keys
  where user_id = actor_profile_id and scope = 'request.create' and key = caller_idempotency_key;
  if found then
    if existing_key.request_hash <> caller_request_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into created_request from public.service_requests where id = existing_key.resource_id;
    return created_request;
  end if;

  if not exists (
    select 1 from public.user_profiles
    where id = actor_profile_id and account_status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'ACCOUNT_NOT_ACTIVE';
  end if;

  select * into property_record from public.properties
  where id = (command_payload ->> 'property_id')::uuid
    and customer_profile_id = actor_profile_id and is_active
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'PROPERTY_NOT_AVAILABLE';
  end if;

  if not exists (
    select 1 from public.service_subcategories s
    join public.service_categories c on c.id = s.category_id
    where s.id = subcategory_id and c.id = category_id and s.is_active and c.is_active
  ) then
    raise exception using errcode = '22023', message = 'SERVICE_NOT_AVAILABLE';
  end if;

  if property_record.service_zone_id is not null and not exists (
    select 1 from public.service_zones z
    where z.id = property_record.service_zone_id
      and z.city_id = property_record.city_id and z.is_active
  ) then
    raise exception using errcode = '22023', message = 'ZONE_NOT_AVAILABLE';
  end if;

  insert into public.service_requests (
    customer_id, property_id, service_category_id, service_subcategory_id,
    title, description, urgency, service_mode, pricing_preference,
    preferred_date, preferred_start_time, preferred_end_time, flexibility_minutes,
    city_id, service_zone_id, latitude, longitude,
    address_snapshot_encrypted, customer_contact_snapshot
  ) values (
    actor_profile_id,
    property_record.id,
    category_id,
    subcategory_id,
    command_payload ->> 'title',
    command_payload ->> 'description',
    coalesce(command_payload ->> 'urgency', 'standard'),
    coalesce(command_payload ->> 'service_mode', 'on_site'),
    coalesce(command_payload ->> 'pricing_preference', 'professional_recommendation'),
    nullif(command_payload ->> 'preferred_date', '')::date,
    nullif(command_payload ->> 'preferred_start_time', '')::time,
    nullif(command_payload ->> 'preferred_end_time', '')::time,
    coalesce((command_payload ->> 'flexibility_minutes')::integer, 60),
    property_record.city_id,
    property_record.service_zone_id,
    property_record.latitude,
    property_record.longitude,
    command_payload ->> 'address_snapshot_encrypted',
    coalesce(command_payload -> 'customer_contact_snapshot', '{}'::jsonb)
  )
  returning * into created_request;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    actor_profile_id, 'request.create', caller_idempotency_key, caller_request_hash,
    201, jsonb_build_object('requestId', created_request.id),
    'service_request', created_request.id, now() + interval '24 hours'
  );

  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'service_request.draft_created', 'service_request', created_request.id,
    jsonb_build_object('customerId', actor_profile_id, 'requestReference', created_request.request_reference)
  );

  insert into public.audit_logs (
    actor_user_profile_id, action, entity_type, entity_id, after_data
  ) values (
    actor_profile_id, 'service_request.create_draft', 'service_request',
    created_request.id::text, jsonb_build_object('version', created_request.version)
  );

  return created_request;
end;
$$;

create or replace function public.update_service_request_draft(
  actor_profile_id uuid,
  target_request_id uuid,
  expected_version integer,
  command_payload jsonb
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_request public.service_requests;
  property_record public.properties;
  updated_request public.service_requests;
  category_id uuid := (command_payload ->> 'service_category_id')::uuid;
  subcategory_id uuid := (command_payload ->> 'service_subcategory_id')::uuid;
begin
  perform set_config('app.actor_profile_id', actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);

  select * into current_request from public.service_requests
  where id = target_request_id and customer_id = actor_profile_id for update;
  if not found then raise exception using errcode = '42501', message = 'REQUEST_NOT_AVAILABLE'; end if;
  if current_request.status <> 'draft' then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_EDITABLE';
  end if;
  if current_request.version <> expected_version then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
  end if;

  select * into property_record from public.properties
  where id = (command_payload ->> 'property_id')::uuid
    and customer_profile_id = actor_profile_id and is_active for share;
  if not found then raise exception using errcode = '42501', message = 'PROPERTY_NOT_AVAILABLE'; end if;

  if not exists (
    select 1 from public.service_subcategories s
    join public.service_categories c on c.id = s.category_id
    where s.id = subcategory_id and c.id = category_id and s.is_active and c.is_active
  ) then raise exception using errcode = '22023', message = 'SERVICE_NOT_AVAILABLE'; end if;

  update public.service_requests set
    property_id = property_record.id,
    service_category_id = category_id,
    service_subcategory_id = subcategory_id,
    title = command_payload ->> 'title',
    description = command_payload ->> 'description',
    urgency = coalesce(command_payload ->> 'urgency', urgency),
    pricing_preference = coalesce(command_payload ->> 'pricing_preference', pricing_preference),
    preferred_date = nullif(command_payload ->> 'preferred_date', '')::date,
    preferred_start_time = nullif(command_payload ->> 'preferred_start_time', '')::time,
    preferred_end_time = nullif(command_payload ->> 'preferred_end_time', '')::time,
    flexibility_minutes = coalesce((command_payload ->> 'flexibility_minutes')::integer, flexibility_minutes),
    city_id = property_record.city_id,
    service_zone_id = property_record.service_zone_id,
    latitude = property_record.latitude,
    longitude = property_record.longitude,
    address_snapshot_encrypted = command_payload ->> 'address_snapshot_encrypted',
    customer_contact_snapshot = coalesce(command_payload -> 'customer_contact_snapshot', customer_contact_snapshot),
    version = version + 1
  where id = target_request_id
  returning * into updated_request;

  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values ('service_request.draft_updated', 'service_request', target_request_id, jsonb_build_object('version', updated_request.version));
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, before_data, after_data)
  values (
    actor_profile_id, 'service_request.update_draft', 'service_request', target_request_id::text,
    jsonb_build_object('version', current_request.version),
    jsonb_build_object('version', updated_request.version)
  );
  return updated_request;
end;
$$;

create or replace function public.submit_service_request(
  actor_profile_id uuid,
  target_request_id uuid,
  expected_version integer,
  caller_idempotency_key text,
  caller_request_hash text
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_key public.idempotency_keys;
  current_request public.service_requests;
  submitted_request public.service_requests;
begin
  perform set_config('app.actor_profile_id', actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);

  select * into existing_key from public.idempotency_keys
  where user_id = actor_profile_id and scope = 'request.submit' and key = caller_idempotency_key;
  if found then
    if existing_key.request_hash <> caller_request_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into submitted_request from public.service_requests where id = existing_key.resource_id;
    return submitted_request;
  end if;

  select * into current_request from public.service_requests
  where id = target_request_id and customer_id = actor_profile_id for update;
  if not found then raise exception using errcode = '42501', message = 'REQUEST_NOT_AVAILABLE'; end if;
  if current_request.status <> 'draft' then raise exception using errcode = '22023', message = 'REQUEST_NOT_SUBMITTABLE'; end if;
  if current_request.version <> expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if current_request.preferred_date is null or current_request.preferred_start_time is null then
    raise exception using errcode = '22023', message = 'REQUEST_SCHEDULE_REQUIRED';
  end if;

  update public.service_requests set
    status = 'submitted',
    matching_status = 'queued',
    submitted_at = now(),
    offer_deadline = now() + interval '24 hours',
    expires_at = now() + interval '7 days',
    version = version + 1
  where id = target_request_id
  returning * into submitted_request;

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    actor_profile_id, 'request.submit', caller_idempotency_key, caller_request_hash,
    200, jsonb_build_object('requestId', target_request_id),
    'service_request', target_request_id, now() + interval '24 hours'
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'service_request.submitted', 'service_request', target_request_id,
    jsonb_build_object('customerId', actor_profile_id, 'requestReference', submitted_request.request_reference)
  );
  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    actor_profile_id, 'in_app', 'service_request.submitted',
    'Service request submitted',
    'Your request is secure and will enter matching when marketplace access is enabled.',
    jsonb_build_object('requestId', target_request_id, 'deepLink', '/customer/requests/' || target_request_id::text)
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (
    actor_profile_id, 'service_request.submit', 'service_request',
    target_request_id::text, jsonb_build_object('version', submitted_request.version)
  );
  return submitted_request;
end;
$$;

create or replace function public.cancel_service_request(
  actor_profile_id uuid,
  target_request_id uuid,
  expected_version integer,
  cancellation_reason text,
  caller_idempotency_key text,
  caller_request_hash text
)
returns public.service_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_key public.idempotency_keys;
  current_request public.service_requests;
  cancelled_request public.service_requests;
begin
  perform set_config('app.actor_profile_id', actor_profile_id::text, true);
  perform set_config('app.actor_role', 'customer', true);

  select * into existing_key from public.idempotency_keys
  where user_id = actor_profile_id and scope = 'request.cancel' and key = caller_idempotency_key;
  if found then
    if existing_key.request_hash <> caller_request_hash then
      raise exception using errcode = '22023', message = 'IDEMPOTENCY_CONFLICT';
    end if;
    select * into cancelled_request from public.service_requests where id = existing_key.resource_id;
    return cancelled_request;
  end if;

  select * into current_request from public.service_requests
  where id = target_request_id and customer_id = actor_profile_id for update;
  if not found then raise exception using errcode = '42501', message = 'REQUEST_NOT_AVAILABLE'; end if;
  if current_request.status not in ('draft', 'submitted', 'matching', 'offers_received', 'no_match') then
    raise exception using errcode = '22023', message = 'REQUEST_NOT_CANCELLABLE';
  end if;
  if current_request.version <> expected_version then raise exception using errcode = '40001', message = 'VERSION_CONFLICT'; end if;
  if char_length(trim(cancellation_reason)) < 3 then
    raise exception using errcode = '22023', message = 'CANCELLATION_REASON_REQUIRED';
  end if;

  update public.service_requests set
    status = 'cancelled',
    matching_status = case when matching_status in ('completed', 'exhausted') then matching_status else 'paused' end,
    cancelled_at = now(),
    cancelled_by = actor_profile_id,
    cancellation_reason = trim(cancellation_reason),
    version = version + 1
  where id = target_request_id
  returning * into cancelled_request;

  update public.request_matching_candidates set
    invitation_status = 'withdrawn', responded_at = coalesce(responded_at, now())
  where request_id = target_request_id
    and invitation_status in ('queued', 'sent', 'delivered', 'viewed');
  update public.professional_offers set
    status = 'rejected', rejected_at = now(), version = version + 1
  where request_id = target_request_id and status = 'submitted';

  insert into public.idempotency_keys (
    user_id, scope, key, request_hash, response_status, response_body_safe,
    resource_type, resource_id, expires_at
  ) values (
    actor_profile_id, 'request.cancel', caller_idempotency_key, caller_request_hash,
    200, jsonb_build_object('requestId', target_request_id),
    'service_request', target_request_id, now() + interval '24 hours'
  );
  insert into public.domain_outbox (event_type, aggregate_type, aggregate_id, payload)
  values (
    'service_request.cancelled', 'service_request', target_request_id,
    jsonb_build_object('customerId', actor_profile_id, 'reason', trim(cancellation_reason))
  );
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, before_data, after_data)
  values (
    actor_profile_id, 'service_request.cancel', 'service_request', target_request_id::text,
    jsonb_build_object('status', current_request.status, 'version', current_request.version),
    jsonb_build_object('status', 'cancelled', 'version', cancelled_request.version)
  );
  return cancelled_request;
end;
$$;

revoke all on function public.create_service_request_draft(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.update_service_request_draft(uuid, uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.submit_service_request(uuid, uuid, integer, text, text) from public, anon, authenticated;
revoke all on function public.cancel_service_request(uuid, uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.create_service_request_draft(uuid, jsonb, text, text) to service_role;
grant execute on function public.update_service_request_draft(uuid, uuid, integer, jsonb) to service_role;
grant execute on function public.submit_service_request(uuid, uuid, integer, text, text) to service_role;
grant execute on function public.cancel_service_request(uuid, uuid, integer, text, text, text) to service_role;
