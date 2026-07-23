-- FixMate Pakistan Phase 2 marketplace foundation.
-- Forward-only: preserves every Phase 1 object and keeps marketplace flags disabled.

create type public.service_request_status as enum (
  'draft', 'submitted', 'matching', 'offers_received', 'professional_selected',
  'converted_to_booking', 'no_match', 'expired', 'cancelled'
);
create type public.matching_run_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');
create type public.invitation_status as enum (
  'queued', 'sent', 'delivered', 'viewed', 'declined', 'offer_submitted',
  'expired', 'withdrawn', 'failed'
);
create type public.professional_offer_status as enum (
  'draft', 'submitted', 'withdrawn', 'expired', 'accepted', 'rejected', 'superseded'
);
create type public.booking_status as enum (
  'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled',
  'cancelled', 'customer_no_show', 'professional_no_show', 'converted_to_job', 'completed'
);
create type public.job_status as enum (
  'created', 'confirmed', 'en_route', 'arrived', 'inspecting', 'awaiting_quotation',
  'awaiting_approval', 'approved', 'in_progress', 'paused', 'completion_submitted',
  'completed', 'cancelled', 'disputed', 'warranty_active', 'closed'
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_reference text not null unique default ('FMR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  service_category_id uuid not null references public.service_categories(id) on delete restrict,
  service_subcategory_id uuid not null references public.service_subcategories(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  urgency text not null default 'standard' check (urgency in ('standard', 'same_day', 'emergency')),
  service_mode text not null default 'on_site' check (service_mode in ('on_site', 'remote_assessment')),
  pricing_preference text not null default 'professional_recommendation'
    check (pricing_preference in ('fixed_price', 'estimated_range', 'inspection_required', 'professional_recommendation')),
  preferred_date date,
  preferred_start_time time,
  preferred_end_time time,
  flexibility_minutes integer not null default 60 check (flexibility_minutes between 0 and 1440),
  estimated_duration_minutes integer check (estimated_duration_minutes between 15 and 2880),
  city_id uuid not null references public.cities(id) on delete restrict,
  service_zone_id uuid references public.service_zones(id) on delete restrict,
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  address_snapshot_encrypted text,
  customer_contact_snapshot jsonb not null default '{}'::jsonb,
  status public.service_request_status not null default 'draft',
  matching_status text not null default 'not_started'
    check (matching_status in ('not_started', 'queued', 'running', 'offers_available', 'exhausted', 'paused', 'completed')),
  offer_deadline timestamptz,
  expires_at timestamptz,
  selected_offer_id uuid,
  submitted_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.user_profiles(id) on delete set null,
  cancellation_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (preferred_end_time is null or preferred_start_time is null or preferred_start_time < preferred_end_time),
  check ((status = 'cancelled' and cancelled_at is not null) or status <> 'cancelled')
);

create table public.service_request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  uploaded_by uuid not null references public.user_profiles(id) on delete restrict,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 1 and 60),
  caption text check (caption is null or char_length(caption) <= 300),
  is_customer_visible boolean not null default true,
  is_professional_visible boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.service_request_status_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  from_status public.service_request_status,
  to_status public.service_request_status not null,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  actor_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.matching_runs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  strategy_version text not null,
  started_at timestamptz,
  completed_at timestamptz,
  status public.matching_run_status not null default 'pending',
  candidate_count integer not null default 0 check (candidate_count >= 0),
  invited_count integer not null default 0 check (invited_count >= 0),
  offer_count integer not null default 0 check (offer_count >= 0),
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.request_matching_candidates (
  id uuid primary key default gen_random_uuid(),
  matching_run_id uuid not null references public.matching_runs(id) on delete cascade,
  request_id uuid not null references public.service_requests(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  eligibility_status text not null check (eligibility_status in ('eligible', 'ineligible', 'pending', 'manually_included', 'manually_excluded')),
  eligibility_reasons jsonb not null default '[]'::jsonb,
  distance_km numeric(8,3) check (distance_km is null or distance_km >= 0),
  service_score numeric(8,4),
  availability_score numeric(8,4),
  quality_score numeric(8,4),
  fairness_score numeric(8,4),
  ranking_score numeric(10,4),
  rank_position integer check (rank_position is null or rank_position > 0),
  invitation_status public.invitation_status not null default 'queued',
  invited_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  decline_reason text,
  created_at timestamptz not null default now(),
  unique (matching_run_id, professional_id)
);

create table public.professional_offers (
  id uuid primary key default gen_random_uuid(),
  offer_reference text not null unique default ('FMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  offer_type text not null check (offer_type in ('fixed_price', 'estimated_range', 'inspection_required')),
  currency_code char(3) not null default 'PKR' check (currency_code ~ '^[A-Z]{3}$'),
  callout_fee_minor bigint not null default 0 check (callout_fee_minor >= 0),
  labor_amount_minor bigint not null default 0 check (labor_amount_minor >= 0),
  material_estimate_minor bigint not null default 0 check (material_estimate_minor >= 0),
  minimum_amount_minor bigint check (minimum_amount_minor is null or minimum_amount_minor >= 0),
  maximum_amount_minor bigint check (maximum_amount_minor is null or maximum_amount_minor >= 0),
  total_amount_minor bigint check (total_amount_minor is null or total_amount_minor >= 0),
  inspection_fee_minor bigint not null default 0 check (inspection_fee_minor >= 0),
  platform_fee_preview_minor bigint not null default 0 check (platform_fee_preview_minor >= 0),
  message text check (message is null or char_length(message) <= 2000),
  estimated_duration_minutes integer check (estimated_duration_minutes between 15 and 2880),
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  requires_inspection boolean not null default false,
  includes_materials boolean not null default false,
  warranty_days integer not null default 0 check (warranty_days between 0 and 3650),
  valid_until timestamptz not null,
  status public.professional_offer_status not null default 'draft',
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  accepted_at timestamptz,
  rejected_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed_end_at is null or proposed_start_at is null or proposed_start_at < proposed_end_at),
  check (maximum_amount_minor is null or minimum_amount_minor is null or minimum_amount_minor <= maximum_amount_minor)
);

create unique index professional_offers_one_active_idx
  on public.professional_offers (request_id, professional_id)
  where status in ('draft', 'submitted', 'accepted');

create table public.professional_offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.professional_offers(id) on delete cascade,
  item_type text not null check (item_type in ('labor', 'material_estimate', 'callout', 'inspection', 'other')),
  description text not null check (char_length(description) between 2 and 300),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'item' check (char_length(unit) between 1 and 30),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accepted_offer_snapshots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete restrict,
  offer_id uuid not null unique references public.professional_offers(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  commercial_terms jsonb not null,
  terms_hash text not null,
  accepted_at timestamptz not null default now()
);

alter table public.service_requests
  add constraint service_requests_selected_offer_fk
  foreign key (selected_offer_id) references public.professional_offers(id) on delete restrict;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null unique default ('FMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  request_id uuid not null unique references public.service_requests(id) on delete restrict,
  accepted_offer_id uuid not null unique references public.professional_offers(id) on delete restrict,
  accepted_offer_snapshot_id uuid not null unique references public.accepted_offer_snapshots(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz not null,
  timezone text not null default 'Asia/Karachi',
  status public.booking_status not null default 'pending_confirmation',
  confirmation_status text not null default 'pending' check (confirmation_status in ('pending', 'confirmed', 'declined', 'expired')),
  reschedule_status text not null default 'none' check (reschedule_status in ('none', 'pending', 'accepted', 'rejected')),
  customer_notes text,
  professional_notes text,
  exact_address_released_at timestamptz,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.user_profiles(id) on delete set null,
  cancellation_reason text,
  no_show_party text check (no_show_party is null or no_show_party in ('customer', 'professional', 'mutual', 'access_issue', 'safety')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_start_at < scheduled_end_at)
);

create table public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'expired')),
  responded_by uuid references public.user_profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (proposed_start_at < proposed_end_at)
);

create unique index booking_one_pending_reschedule_idx
  on public.booking_reschedule_requests (booking_id) where status = 'pending';

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  job_reference text not null unique default ('FMJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  request_id uuid not null unique references public.service_requests(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  service_category_id uuid not null references public.service_categories(id) on delete restrict,
  service_subcategory_id uuid not null references public.service_subcategories(id) on delete restrict,
  status public.job_status not null default 'created',
  work_status text not null default 'not_started' check (work_status in ('not_started', 'inspection', 'awaiting_approval', 'in_progress', 'paused', 'completed')),
  payment_status text not null default 'not_due' check (payment_status in ('not_due', 'due', 'pending', 'paid', 'partially_refunded', 'refunded', 'disputed')),
  warranty_status text not null default 'not_issued' check (warranty_status in ('not_issued', 'pending', 'active', 'expired', 'claim_open', 'fulfilled', 'voided')),
  dispute_status text not null default 'none' check (dispute_status in ('none', 'open', 'under_review', 'resolved', 'closed')),
  scheduled_start_at timestamptz not null,
  actual_en_route_at timestamptz,
  actual_arrived_at timestamptz,
  inspection_started_at timestamptz,
  work_started_at timestamptz,
  completion_submitted_at timestamptz,
  customer_completed_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_status_history (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status public.job_status,
  to_status public.job_status not null,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  actor_role text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.arrival_verifications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 10),
  verified_at timestamptz,
  verified_by_professional_id uuid references public.professional_profiles(user_profile_id) on delete set null,
  status text not null default 'active' check (status in ('active', 'verified', 'expired', 'revoked', 'locked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index arrival_one_active_code_idx on public.arrival_verifications (job_id) where status = 'active';

create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  scope text not null,
  key text not null,
  request_hash text not null,
  response_status integer,
  response_body_safe jsonb,
  resource_type text,
  resource_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, scope, key)
);

create table public.domain_outbox (
  id bigint generated always as identity primary key,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  processed_at timestamptz,
  last_error_safe text,
  created_at timestamptz not null default now()
);

create index service_requests_customer_status_idx on public.service_requests (customer_id, status, created_at desc);
create index service_requests_market_idx on public.service_requests (city_id, service_zone_id, status, preferred_date);
create index service_request_media_request_idx on public.service_request_media (request_id, created_at);
create index service_request_history_idx on public.service_request_status_history (request_id, created_at);
create index matching_runs_request_idx on public.matching_runs (request_id, created_at desc);
create index matching_candidates_professional_idx on public.request_matching_candidates (professional_id, invitation_status, expires_at);
create index matching_candidates_request_idx on public.request_matching_candidates (request_id, invitation_status);
create index professional_offers_request_status_idx on public.professional_offers (request_id, status, submitted_at);
create index professional_offers_professional_idx on public.professional_offers (professional_id, status, created_at desc);
create index bookings_customer_idx on public.bookings (customer_id, status, scheduled_start_at);
create index bookings_professional_idx on public.bookings (professional_id, status, scheduled_start_at);
create index jobs_customer_idx on public.jobs (customer_id, status, created_at desc);
create index jobs_professional_idx on public.jobs (professional_id, status, scheduled_start_at);
create index idempotency_expiry_idx on public.idempotency_keys (expires_at);
create index domain_outbox_retry_idx on public.domain_outbox (status, next_attempt_at) where status in ('pending', 'failed');

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'service_requests', 'professional_offers', 'professional_offer_items',
    'bookings', 'jobs'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.record_service_request_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.service_request_status_history (
      request_id, from_status, to_status, actor_user_id, actor_role
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      public.current_profile_id(),
      case
        when public.has_role('super_admin') then 'super_admin'
        when public.has_role('admin') then 'admin'
        when public.has_role('support') then 'support'
        when public.has_role('professional') then 'professional'
        else 'customer'
      end
    );
  end if;
  return new;
end;
$$;

create trigger service_request_status_history_trigger
  after insert or update of status on public.service_requests
  for each row execute function public.record_service_request_status();

create or replace function public.record_job_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.job_status_history (job_id, from_status, to_status, actor_user_id, actor_role)
    values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      public.current_profile_id(),
      case
        when public.has_role('super_admin') then 'super_admin'
        when public.has_role('admin') then 'admin'
        when public.has_role('support') then 'support'
        when public.has_role('professional') then 'professional'
        else 'customer'
      end
    );
  end if;
  return new;
end;
$$;

create trigger job_status_history_trigger
  after insert or update of status on public.jobs
  for each row execute function public.record_job_status();

insert into public.system_settings (key, value, is_public, description)
values
  ('phase2.marketplace_enabled', 'false'::jsonb, true, 'Master Phase 2 marketplace release flag.'),
  ('phase2.requests_enabled', 'false'::jsonb, true, 'Customer service-request workflow flag.'),
  ('phase2.matching_enabled', 'false'::jsonb, true, 'Professional matching and offers flag.'),
  ('phase2.jobs_enabled', 'false'::jsonb, true, 'Booking and job execution flag.'),
  ('phase2.payments_enabled', 'false'::jsonb, true, 'Marketplace payment workflow flag.')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-request-media',
  'service-request-media',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'service_requests', 'service_request_media', 'service_request_status_history',
    'matching_runs', 'request_matching_candidates', 'professional_offers',
    'professional_offer_items', 'accepted_offer_snapshots', 'bookings',
    'booking_reschedule_requests', 'jobs', 'job_status_history',
    'arrival_verifications', 'idempotency_keys', 'domain_outbox'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end;
$$;

create policy service_requests_customer_admin_read on public.service_requests for select to authenticated
  using (customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy service_request_media_customer_admin_read on public.service_request_media for select to authenticated
  using (exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and (r.customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy request_history_customer_admin_read on public.service_request_status_history for select to authenticated
  using (exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and (r.customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy matching_runs_customer_staff_read on public.matching_runs for select to authenticated
  using (exists (
    select 1 from public.service_requests r
    where r.id = request_id
      and (r.customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy matching_candidates_professional_staff_read on public.request_matching_candidates for select to authenticated
  using (professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy offers_participant_staff_read on public.professional_offers for select to authenticated
  using (
    professional_id = public.current_profile_id()
    or public.is_admin()
    or public.has_role('support')
    or exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.customer_id = public.current_profile_id()
    )
  );
create policy offer_items_participant_staff_read on public.professional_offer_items for select to authenticated
  using (exists (
    select 1 from public.professional_offers o
    join public.service_requests r on r.id = o.request_id
    where o.id = offer_id
      and (
        o.professional_id = public.current_profile_id()
        or r.customer_id = public.current_profile_id()
        or public.is_admin()
        or public.has_role('support')
      )
  ));
create policy accepted_snapshots_participant_staff_read on public.accepted_offer_snapshots for select to authenticated
  using (
    customer_id = public.current_profile_id()
    or professional_id = public.current_profile_id()
    or public.is_admin()
    or public.has_role('support')
  );
create policy bookings_participant_staff_read on public.bookings for select to authenticated
  using (
    customer_id = public.current_profile_id()
    or professional_id = public.current_profile_id()
    or public.is_admin()
    or public.has_role('support')
  );
create policy reschedules_participant_staff_read on public.booking_reschedule_requests for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (
        b.customer_id = public.current_profile_id()
        or b.professional_id = public.current_profile_id()
        or public.is_admin()
        or public.has_role('support')
      )
  ));
create policy jobs_participant_staff_read on public.jobs for select to authenticated
  using (
    customer_id = public.current_profile_id()
    or professional_id = public.current_profile_id()
    or public.is_admin()
    or public.has_role('support')
  );
create policy job_history_participant_staff_read on public.job_status_history for select to authenticated
  using (exists (
    select 1 from public.jobs j
    where j.id = job_id
      and (
        j.customer_id = public.current_profile_id()
        or j.professional_id = public.current_profile_id()
        or public.is_admin()
        or public.has_role('support')
      )
  ));
create policy arrival_customer_staff_read on public.arrival_verifications for select to authenticated
  using (exists (
    select 1 from public.jobs j
    where j.id = job_id
      and (j.customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy idempotency_owner_read on public.idempotency_keys for select to authenticated
  using (user_id = public.current_profile_id() or public.is_admin());
create policy outbox_admin_read on public.domain_outbox for select to authenticated using (public.is_admin());

create policy request_media_owner_storage_read on storage.objects for select to authenticated
  using (
    bucket_id = 'service-request-media'
    and split_part(name, '/', 1) = public.current_profile_id()::text
  );
create policy request_media_owner_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'service-request-media'
    and split_part(name, '/', 1) = public.current_profile_id()::text
  );
create policy request_media_owner_storage_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'service-request-media'
    and split_part(name, '/', 1) = public.current_profile_id()::text
  );

revoke insert, update, delete on public.service_request_status_history from authenticated;
revoke insert, update, delete on public.matching_runs from authenticated;
revoke insert, update, delete on public.request_matching_candidates from authenticated;
revoke insert, update, delete on public.accepted_offer_snapshots from authenticated;
revoke insert, update, delete on public.bookings from authenticated;
revoke insert, update, delete on public.jobs from authenticated;
revoke insert, update, delete on public.job_status_history from authenticated;
revoke all on public.arrival_verifications from anon, authenticated;
revoke all on public.idempotency_keys from anon, authenticated;
revoke all on public.domain_outbox from anon, authenticated;
