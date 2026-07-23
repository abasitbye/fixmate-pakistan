-- FixMate Pakistan Phase 1 foundation
-- PostgreSQL/Supabase schema, security model, workflow controls, and launch seed data.

create extension if not exists pgcrypto;
create extension if not exists citext;

create type public.account_status as enum ('active', 'suspended', 'disabled');
create type public.professional_application_status as enum (
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'suspended'
);
create type public.review_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.verification_status as enum ('pending', 'verified', 'failed', 'expired');
create type public.notification_channel as enum ('in_app', 'email', 'push');
create type public.notification_delivery_status as enum ('pending', 'sent', 'failed', 'read');
create type public.availability_override_kind as enum ('available', 'unavailable');
create type public.property_type as enum ('house', 'apartment', 'office', 'shop', 'other');

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email citext not null,
  display_name text,
  phone text,
  preferred_locale text not null default 'en' check (preferred_locale in ('en', 'ur', 'ur-Latn')),
  avatar_path text,
  account_status public.account_status not null default 'active',
  suspension_reason text,
  onboarding_completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (phone is null or phone ~ '^\\+?[0-9][0-9 -]{7,18}$'),
  check ((account_status = 'suspended') or suspension_reason is null)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  is_active boolean not null default true,
  granted_by uuid references public.user_profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_profile_id, role_id),
  check ((is_active and revoked_at is null) or (not is_active))
);

create table public.customer_profiles (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.countries (
  id uuid primary key default gen_random_uuid(),
  iso_code char(2) not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.provinces (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references public.countries(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_id, code),
  unique (country_id, name)
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (province_id, name)
);

create table public.service_zones (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id) on delete restrict,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city_id, name)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references public.customer_profiles(user_profile_id) on delete cascade,
  label text not null,
  property_type public.property_type not null default 'house',
  address_line_1 text not null,
  address_line_2 text,
  city_id uuid not null references public.cities(id) on delete restrict,
  service_zone_id uuid references public.service_zones(id) on delete set null,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  access_notes text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check ((latitude is null) = (longitude is null))
);

create unique index properties_one_default_per_customer
  on public.properties (customer_profile_id) where is_default and is_active;

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ur text not null,
  name_roman_ur text not null,
  description_en text,
  description_ur text,
  description_roman_ur text,
  icon_name text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ur text not null,
  name_roman_ur text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);

create table public.professional_profiles (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  application_status public.professional_application_status not null default 'draft',
  business_name text,
  cnic_last4 char(4),
  years_experience smallint check (years_experience between 0 and 80),
  bio text,
  primary_city_id uuid references public.cities(id) on delete restrict,
  travel_radius_km smallint check (travel_radius_km between 1 and 100),
  has_tools boolean,
  has_transport boolean,
  reviewer_id uuid references public.user_profiles(id) on delete set null,
  review_notes text,
  changes_requested_reason text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cnic_last4 is null or cnic_last4 ~ '^[0-9]{4}$')
);

create table public.professional_references (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  full_name text not null,
  relationship text not null,
  phone text not null,
  notes text,
  verification_status public.verification_status not null default 'pending',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.verification_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  verification_type_id uuid not null references public.verification_types(id) on delete restrict,
  storage_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  review_status public.review_status not null default 'pending',
  review_notes text,
  reviewed_by uuid references public.user_profiles(id) on delete set null,
  reviewed_at timestamptz,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_profile_id, verification_type_id, storage_path)
);

create table public.professional_verifications (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  verification_type_id uuid not null references public.verification_types(id) on delete restrict,
  status public.verification_status not null default 'pending',
  provider_reference text,
  notes text,
  verified_by uuid references public.user_profiles(id) on delete set null,
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_profile_id, verification_type_id)
);

create table public.professional_services (
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  service_subcategory_id uuid not null references public.service_subcategories(id) on delete restrict,
  years_experience smallint check (years_experience between 0 and 80),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (professional_profile_id, service_subcategory_id)
);

create table public.professional_service_areas (
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  service_zone_id uuid not null references public.service_zones(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (professional_profile_id, service_zone_id)
);

create table public.professional_availability_schedules (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (professional_profile_id, day_of_week, start_time, end_time)
);

create table public.professional_availability_overrides (
  id uuid primary key default gen_random_uuid(),
  professional_profile_id uuid not null references public.professional_profiles(user_profile_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind public.availability_override_kind not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.professional_payout_profiles (
  professional_profile_id uuid primary key references public.professional_profiles(user_profile_id) on delete cascade,
  payout_method text,
  account_title text,
  account_reference_encrypted text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (payout_method is null or payout_method in ('bank', 'easypaisa', 'jazzcash'))
);

create table public.notification_preferences (
  user_profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  push_enabled boolean not null default true,
  transactional_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('web', 'android', 'ios')),
  device_label text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  channel public.notification_channel not null,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  delivery_status public.notification_delivery_status not null default 'pending',
  provider_message_id text,
  sent_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);

create table public.consent_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  current_version text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  consent_type_id uuid not null references public.consent_types(id) on delete restrict,
  version text not null,
  accepted boolean not null,
  ip_address inet,
  user_agent text,
  recorded_at timestamptz not null default now(),
  unique (user_profile_id, consent_type_id, version)
);

create table public.support_notes (
  id uuid primary key default gen_random_uuid(),
  subject_user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  author_user_profile_id uuid not null references public.user_profiles(id) on delete restrict,
  note text not null,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_profile_id uuid references public.user_profiles(id) on delete set null,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]*$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  scope text not null,
  identifier_hash text not null,
  occurred_at timestamptz not null default now()
);

create index user_profiles_email_idx on public.user_profiles (email);
create index user_roles_active_idx on public.user_roles (user_profile_id, is_active);
create index properties_customer_idx on public.properties (customer_profile_id, is_active);
create index professional_profiles_status_idx on public.professional_profiles (application_status, updated_at desc);
create index professional_documents_professional_idx on public.professional_documents (professional_profile_id, review_status);
create index professional_services_subcategory_idx on public.professional_services (service_subcategory_id, is_active);
create index professional_service_areas_zone_idx on public.professional_service_areas (service_zone_id, is_active);
create index notifications_user_created_idx on public.notifications (user_profile_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_profile_id, created_at desc);
create index rate_limit_lookup_idx on public.rate_limit_events (scope, identifier_hash, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles', 'customer_profiles', 'service_zones', 'properties',
    'service_categories', 'service_subcategories', 'professional_profiles',
    'professional_references', 'professional_documents', 'professional_verifications',
    'professional_services', 'professional_availability_schedules',
    'professional_availability_overrides', 'professional_payout_profiles',
    'notification_preferences', 'notification_devices', 'consent_types',
    'support_notes', 'system_settings'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.user_profiles where auth_user_id = auth.uid()
$$;

create or replace function public.has_role(requested_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_profile_id = public.current_profile_id()
      and ur.is_active
      and r.code = requested_role
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin') or public.has_role('super_admin')
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id uuid;
  customer_role_id uuid;
begin
  insert into public.user_profiles (auth_user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@pending.fixmate.local'),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  returning id into profile_id;

  select id into customer_role_id from public.roles where code = 'customer';
  if customer_role_id is not null then
    insert into public.user_roles (user_profile_id, role_id)
    values (profile_id, customer_role_id)
    on conflict do nothing;
  end if;

  insert into public.customer_profiles (user_profile_id) values (profile_id);
  insert into public.notification_preferences (user_profile_id) values (profile_id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.transition_professional_application(
  target_professional_id uuid,
  target_status public.professional_application_status,
  decision_notes text default null
)
returns public.professional_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.professional_profiles;
  actor_id uuid := public.current_profile_id();
  actor_is_admin boolean := public.is_admin();
  prior_status public.professional_application_status;
  allowed boolean := false;
  professional_role_id uuid;
begin
  select * into application
  from public.professional_profiles
  where user_profile_id = target_professional_id
  for update;

  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  prior_status := application.application_status;

  if actor_id = target_professional_id then
    allowed := (prior_status = 'draft' and target_status = 'submitted')
      or (prior_status = 'changes_requested' and target_status = 'submitted');
  end if;

  if actor_is_admin then
    allowed := allowed
      or (prior_status = 'submitted' and target_status = 'under_review')
      or (prior_status = 'under_review' and target_status in ('changes_requested', 'approved', 'rejected'))
      or (prior_status = 'approved' and target_status = 'suspended')
      or (prior_status = 'suspended' and target_status = 'approved');
  end if;

  if not allowed then raise exception 'INVALID_APPLICATION_TRANSITION'; end if;
  if target_status in ('changes_requested', 'rejected', 'suspended') and nullif(trim(coalesce(decision_notes, '')), '') is null then
    raise exception 'DECISION_NOTES_REQUIRED';
  end if;

  update public.professional_profiles
  set application_status = target_status,
      reviewer_id = case when actor_is_admin then actor_id else reviewer_id end,
      review_notes = case when actor_is_admin then decision_notes else review_notes end,
      changes_requested_reason = case when target_status = 'changes_requested' then decision_notes else null end,
      submitted_at = case when target_status = 'submitted' then now() else submitted_at end,
      reviewed_at = case when target_status in ('changes_requested', 'approved', 'rejected', 'suspended') then now() else reviewed_at end,
      approved_at = case when target_status = 'approved' then now() else approved_at end,
      rejected_at = case when target_status = 'rejected' then now() else rejected_at end,
      suspended_at = case when target_status = 'suspended' then now() when target_status = 'approved' then null else suspended_at end
  where user_profile_id = target_professional_id
  returning * into application;

  if target_status = 'approved' then
    select id into professional_role_id from public.roles where code = 'professional';
    insert into public.user_roles (user_profile_id, role_id, is_active, granted_by, revoked_at)
    values (target_professional_id, professional_role_id, true, actor_id, null)
    on conflict (user_profile_id, role_id) do update
      set is_active = true, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null;
  elsif target_status = 'suspended' then
    update public.user_roles ur
    set is_active = false, revoked_at = now()
    from public.roles r
    where ur.user_profile_id = target_professional_id and ur.role_id = r.id and r.code = 'professional';
  end if;

  insert into public.audit_logs (
    actor_user_profile_id, actor_auth_user_id, action, entity_type, entity_id, before_data, after_data
  ) values (
    actor_id, auth.uid(), 'professional_application.transition', 'professional_profile', target_professional_id::text,
    jsonb_build_object('status', prior_status), jsonb_build_object('status', target_status, 'notes', decision_notes)
  );

  insert into public.notifications (user_profile_id, channel, type, title, body, data)
  values (
    target_professional_id, 'in_app', 'professional_application_status', 'Application status updated',
    'Your professional application status has changed.',
    jsonb_build_object('status', target_status)
  );

  return application;
end;
$$;

create or replace function public.review_professional_document(
  target_document_id uuid,
  target_status public.review_status,
  decision_notes text default null
)
returns public.professional_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  document public.professional_documents;
  prior_status public.review_status;
  actor_id uuid := public.current_profile_id();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if target_status not in ('approved', 'rejected', 'expired') then raise exception 'INVALID_DOCUMENT_STATUS'; end if;
  if target_status = 'rejected' and nullif(trim(coalesce(decision_notes, '')), '') is null then
    raise exception 'DECISION_NOTES_REQUIRED';
  end if;

  select * into document from public.professional_documents where id = target_document_id for update;
  if not found then raise exception 'DOCUMENT_NOT_FOUND'; end if;
  prior_status := document.review_status;

  update public.professional_documents
  set review_status = target_status, review_notes = decision_notes, reviewed_by = actor_id, reviewed_at = now()
  where id = target_document_id
  returning * into document;

  insert into public.audit_logs (actor_user_profile_id, actor_auth_user_id, action, entity_type, entity_id, before_data, after_data)
  values (actor_id, auth.uid(), 'professional_document.review', 'professional_document', target_document_id::text,
    jsonb_build_object('status', prior_status), jsonb_build_object('status', target_status, 'notes', decision_notes));

  return document;
end;
$$;

insert into public.roles (code, name, description) values
  ('customer', 'Customer', 'Can manage a customer profile and properties.'),
  ('professional', 'Professional', 'Approved service professional.'),
  ('support', 'Support', 'Limited customer and professional support access.'),
  ('admin', 'Administrator', 'Operational administration access.'),
  ('super_admin', 'Super administrator', 'Full platform administration access.')
on conflict (code) do nothing;

insert into public.countries (iso_code, name) values ('PK', 'Pakistan') on conflict do nothing;
insert into public.provinces (country_id, code, name)
select id, 'ICT', 'Islamabad Capital Territory' from public.countries where iso_code = 'PK'
on conflict do nothing;
insert into public.provinces (country_id, code, name)
select id, 'PB', 'Punjab' from public.countries where iso_code = 'PK'
on conflict do nothing;
insert into public.cities (province_id, name)
select id, 'Islamabad' from public.provinces where code = 'ICT' on conflict do nothing;
insert into public.cities (province_id, name)
select id, 'Rawalpindi' from public.provinces where code = 'PB' on conflict do nothing;

insert into public.service_categories (slug, name_en, name_ur, name_roman_ur, icon_name, display_order) values
  ('plumbing', 'Plumbing', 'پلمبنگ', 'Plumbing', 'Wrench', 10),
  ('electrical', 'Electrical', 'بجلی کا کام', 'Bijli ka kaam', 'Zap', 20),
  ('ac-refrigeration', 'AC and Refrigeration', 'اے سی اور ریفریجریشن', 'AC aur refrigeration', 'Snowflake', 30),
  ('appliance-repair', 'Appliance Repair', 'گھریلو آلات کی مرمت', 'Gharelu alat ki marammat', 'Microwave', 40),
  ('carpentry-furniture-repair', 'Carpentry and Furniture Repair', 'بڑھئی اور فرنیچر کی مرمت', 'Carpentry aur furniture repair', 'Hammer', 50),
  ('handyman-general-repairs', 'Handyman and General Repairs', 'ہینڈی مین اور عام مرمت', 'Handyman aur aam marammat', 'Drill', 60)
on conflict (slug) do nothing;

with seed(category_slug, slug, name_en, name_ur, name_roman_ur, display_order) as (values
  ('plumbing','water-leakage','Water leakage','پانی کا رساؤ','Pani ka risao',10),
  ('plumbing','tap-mixer-replacement','Tap and mixer replacement','نل اور مکسر کی تبدیلی','Nal aur mixer ki tabdeeli',20),
  ('plumbing','blocked-drain','Blocked drain','بند نالی','Band naali',30),
  ('plumbing','toilet-repair','Toilet repair','ٹوائلٹ کی مرمت','Toilet ki marammat',40),
  ('plumbing','water-tank-connection','Water-tank connection','پانی کی ٹینکی کا کنکشن','Pani ki tanki ka connection',50),
  ('plumbing','pipe-replacement','Pipe replacement','پائپ کی تبدیلی','Pipe ki tabdeeli',60),
  ('plumbing','motor-pump-issue','Motor and pump issue','موٹر اور پمپ کا مسئلہ','Motor aur pump ka masla',70),
  ('plumbing','geyser-plumbing','Geyser plumbing','گیزر پلمبنگ','Geyser plumbing',80),
  ('electrical','electrical-fault-finding','Electrical fault finding','بجلی کی خرابی تلاش کرنا','Bijli ki kharabi talash karna',10),
  ('electrical','switch-socket-replacement','Switch or socket replacement','سوئچ یا ساکٹ کی تبدیلی','Switch ya socket ki tabdeeli',20),
  ('electrical','light-installation','Light installation','لائٹ کی تنصیب','Light installation',30),
  ('electrical','circuit-breaker-problem','Circuit-breaker problem','سرکٹ بریکر کا مسئلہ','Circuit breaker ka masla',40),
  ('electrical','fan-installation','Fan installation','پنکھے کی تنصیب','Pankhay ki installation',50),
  ('electrical','fan-repair','Fan repair','پنکھے کی مرمت','Pankhay ki marammat',60),
  ('electrical','wiring-issue','Wiring issue','وائرنگ کا مسئلہ','Wiring ka masla',70),
  ('electrical','ups-inverter-connection','UPS or inverter connection','یو پی ایس یا انورٹر کنکشن','UPS ya inverter connection',80),
  ('electrical','emergency-electrical-fault','Emergency electrical fault','ہنگامی بجلی کی خرابی','Emergency bijli ki kharabi',90),
  ('ac-refrigeration','ac-inspection','AC inspection','اے سی معائنہ','AC inspection',10),
  ('ac-refrigeration','ac-servicing','AC servicing','اے سی سروس','AC service',20),
  ('ac-refrigeration','ac-gas-charging','AC gas charging','اے سی گیس چارجنگ','AC gas charging',30),
  ('ac-refrigeration','ac-installation','AC installation','اے سی تنصیب','AC installation',40),
  ('ac-refrigeration','ac-removal','AC removal','اے سی اتارنا','AC utarna',50),
  ('ac-refrigeration','cooling-problem','Cooling problem','کولنگ کا مسئلہ','Cooling ka masla',60),
  ('ac-refrigeration','ac-water-leakage','AC water leakage','اے سی پانی کا رساؤ','AC pani ka risao',70),
  ('ac-refrigeration','refrigerator-inspection','Refrigerator inspection','فریج معائنہ','Fridge inspection',80),
  ('ac-refrigeration','refrigerator-repair','Refrigerator repair','فریج کی مرمت','Fridge ki marammat',90),
  ('appliance-repair','washing-machine','Washing machine','واشنگ مشین','Washing machine',10),
  ('appliance-repair','microwave-oven','Microwave oven','مائیکروویو اوون','Microwave oven',20),
  ('appliance-repair','water-dispenser','Water dispenser','واٹر ڈسپنسر','Water dispenser',30),
  ('appliance-repair','geyser','Geyser','گیزر','Geyser',40),
  ('appliance-repair','kitchen-hood','Kitchen hood','کچن ہڈ','Kitchen hood',50),
  ('appliance-repair','small-household-appliance','Small household appliance','چھوٹا گھریلو آلہ','Chhota gharelu ala',60),
  ('carpentry-furniture-repair','door-repair','Door repair','دروازے کی مرمت','Darwazay ki marammat',10),
  ('carpentry-furniture-repair','lock-repair','Lock repair','تالے کی مرمت','Talay ki marammat',20),
  ('carpentry-furniture-repair','cabinet-repair','Cabinet repair','کابینہ کی مرمت','Cabinet ki marammat',30),
  ('carpentry-furniture-repair','furniture-assembly','Furniture assembly','فرنیچر جوڑنا','Furniture jorna',40),
  ('carpentry-furniture-repair','shelving','Shelving','شیلف لگانا','Shelf lagana',50),
  ('carpentry-furniture-repair','wooden-fixtures','Wooden fixtures','لکڑی کے فکسچر','Lakri ke fixtures',60),
  ('carpentry-furniture-repair','hinges-handles','Hinges and handles','قبضے اور ہینڈل','Qabzay aur handles',70),
  ('carpentry-furniture-repair','minor-furniture-restoration','Minor furniture restoration','فرنیچر کی معمولی بحالی','Furniture ki mamooli bahali',80),
  ('handyman-general-repairs','curtain-rod-installation','Curtain-rod installation','پردے کی راڈ لگانا','Parday ki rod lagana',10),
  ('handyman-general-repairs','tv-mounting','TV mounting','ٹی وی لگانا','TV lagana',20),
  ('handyman-general-repairs','picture-mirror-hanging','Picture or mirror hanging','تصویر یا آئینہ لٹکانا','Tasveer ya aaina latkana',30),
  ('handyman-general-repairs','minor-drilling','Minor drilling','معمولی ڈرلنگ','Mamooli drilling',40),
  ('handyman-general-repairs','furniture-assembly','Furniture assembly','فرنیچر جوڑنا','Furniture jorna',50),
  ('handyman-general-repairs','sealant-application','Sealant application','سیلنٹ لگانا','Sealant lagana',60),
  ('handyman-general-repairs','small-wall-repair','Small wall repair','دیوار کی چھوٹی مرمت','Deewar ki chhoti marammat',70),
  ('handyman-general-repairs','general-household-repair','General household repair','عام گھریلو مرمت','Aam gharelu marammat',80)
)
insert into public.service_subcategories (category_id, slug, name_en, name_ur, name_roman_ur, display_order)
select c.id, s.slug, s.name_en, s.name_ur, s.name_roman_ur, s.display_order
from seed s join public.service_categories c on c.slug = s.category_slug
on conflict (category_id, slug) do nothing;

insert into public.verification_types (code, name, description, is_required) values
  ('cnic_front', 'CNIC front', 'Front image of the applicant CNIC.', true),
  ('cnic_back', 'CNIC back', 'Back image of the applicant CNIC.', true),
  ('identity_selfie', 'Identity selfie', 'Live identity selfie for manual comparison.', true),
  ('address_proof', 'Address proof', 'Recent proof of residential address.', true),
  ('police_character_certificate', 'Police character certificate', 'Optional police-issued character certificate.', false),
  ('trade_certificate', 'Trade certificate', 'Optional relevant trade qualification.', false)
on conflict (code) do nothing;

insert into public.consent_types (code, name, current_version, is_required) values
  ('terms_of_service', 'Terms of Service', '1.0', true),
  ('privacy_policy', 'Privacy Policy', '1.0', true),
  ('professional_declaration', 'Professional Applicant Declaration', '1.0', true),
  ('marketing_communications', 'Marketing Communications', '1.0', false)
on conflict (code) do nothing;

insert into public.system_settings (key, value, is_public, description) values
  ('platform.support_email', '"support@fixmate.pk"'::jsonb, true, 'Public support email address.'),
  ('platform.launch_cities', '["Islamabad", "Rawalpindi"]'::jsonb, true, 'Phase 1 launch cities.'),
  ('professional.max_document_bytes', '10485760'::jsonb, true, 'Maximum professional document size in bytes.'),
  ('auth.otp_cooldown_seconds', '60'::jsonb, false, 'Minimum delay between OTP requests.'),
  ('auth.otp_hourly_limit', '5'::jsonb, false, 'Maximum OTP requests per identifier each hour.')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-images', 'profile-images', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('professional-documents', 'professional-documents', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('verification-selfies', 'verification-selfies', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.countries enable row level security;
alter table public.provinces enable row level security;
alter table public.cities enable row level security;
alter table public.service_zones enable row level security;
alter table public.properties enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_subcategories enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_references enable row level security;
alter table public.verification_types enable row level security;
alter table public.professional_documents enable row level security;
alter table public.professional_verifications enable row level security;
alter table public.professional_services enable row level security;
alter table public.professional_service_areas enable row level security;
alter table public.professional_availability_schedules enable row level security;
alter table public.professional_availability_overrides enable row level security;
alter table public.professional_payout_profiles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notifications enable row level security;
alter table public.consent_types enable row level security;
alter table public.user_consents enable row level security;
alter table public.support_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.system_settings enable row level security;
alter table public.rate_limit_events enable row level security;

create policy user_profiles_select_self_or_admin on public.user_profiles for select
  using (id = public.current_profile_id() or public.is_admin());
create policy user_profiles_update_self_or_admin on public.user_profiles for update
  using (id = public.current_profile_id() or public.is_admin())
  with check (id = public.current_profile_id() or public.is_admin());
create policy roles_authenticated_read on public.roles for select to authenticated using (true);
create policy user_roles_read_own_or_admin on public.user_roles for select
  using (user_profile_id = public.current_profile_id() or public.is_admin());
create policy customer_profiles_owner_or_admin on public.customer_profiles for all
  using (user_profile_id = public.current_profile_id() or public.is_admin())
  with check (user_profile_id = public.current_profile_id() or public.is_admin());

create policy countries_public_read on public.countries for select using (is_active or public.is_admin());
create policy provinces_public_read on public.provinces for select using (is_active or public.is_admin());
create policy cities_public_read on public.cities for select using (is_active or public.is_admin());
create policy service_zones_public_read on public.service_zones for select using (is_active or public.is_admin());
create policy service_categories_public_read on public.service_categories for select using (is_active or public.is_admin());
create policy service_subcategories_public_read on public.service_subcategories for select using (is_active or public.is_admin());
create policy verification_types_authenticated_read on public.verification_types for select to authenticated using (is_active or public.is_admin());
create policy consent_types_public_read on public.consent_types for select using (is_active or public.is_admin());
create policy system_settings_public_read on public.system_settings for select using (is_public or public.is_admin());

create policy properties_owner_or_admin on public.properties for all
  using (customer_profile_id = public.current_profile_id() or public.is_admin())
  with check (customer_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_profiles_owner_or_admin on public.professional_profiles for all
  using (user_profile_id = public.current_profile_id() or public.is_admin())
  with check (user_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_references_owner_or_admin on public.professional_references for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_documents_owner_or_admin on public.professional_documents for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_verifications_owner_or_admin on public.professional_verifications for select
  using (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_services_owner_or_admin on public.professional_services for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_service_areas_owner_or_admin on public.professional_service_areas for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_schedules_owner_or_admin on public.professional_availability_schedules for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_overrides_owner_or_admin on public.professional_availability_overrides for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());
create policy professional_payout_owner_or_admin on public.professional_payout_profiles for all
  using (professional_profile_id = public.current_profile_id() or public.is_admin())
  with check (professional_profile_id = public.current_profile_id() or public.is_admin());

create policy notification_preferences_owner_or_admin on public.notification_preferences for all
  using (user_profile_id = public.current_profile_id() or public.is_admin())
  with check (user_profile_id = public.current_profile_id() or public.is_admin());
create policy notification_devices_owner_or_admin on public.notification_devices for all
  using (user_profile_id = public.current_profile_id() or public.is_admin())
  with check (user_profile_id = public.current_profile_id() or public.is_admin());
create policy notifications_owner_read on public.notifications for select
  using (user_profile_id = public.current_profile_id() or public.is_admin());
create policy notifications_owner_update on public.notifications for update
  using (user_profile_id = public.current_profile_id() or public.is_admin())
  with check (user_profile_id = public.current_profile_id() or public.is_admin());
create policy user_consents_owner_or_admin on public.user_consents for select
  using (user_profile_id = public.current_profile_id() or public.is_admin());
create policy user_consents_owner_insert on public.user_consents for insert
  with check (user_profile_id = public.current_profile_id());
create policy support_notes_admin_only on public.support_notes for all
  using (public.is_admin()) with check (public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select using (public.is_admin());

create policy profile_images_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_images_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy professional_documents_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'professional-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy professional_documents_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'professional-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy professional_documents_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'professional-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy verification_selfies_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'verification-selfies' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy verification_selfies_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);
create policy verification_selfies_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'verification-selfies' and (storage.foldername(name))[1] = auth.uid()::text);

revoke update on public.user_profiles from authenticated;
grant update (display_name, phone, preferred_locale, avatar_path, onboarding_completed_at, last_seen_at) on public.user_profiles to authenticated;
revoke update on public.professional_profiles from authenticated;
grant update (business_name, cnic_last4, years_experience, bio, primary_city_id, travel_radius_km, has_tools, has_transport) on public.professional_profiles to authenticated;
revoke update, delete on public.audit_logs from anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;
grant execute on function public.transition_professional_application(uuid, public.professional_application_status, text) to authenticated;
grant execute on function public.review_professional_document(uuid, public.review_status, text) to authenticated;

comment on table public.audit_logs is 'Append-only record of privileged and workflow actions.';
comment on table public.professional_payout_profiles is 'Phase 1 payout readiness only; real payment movement is reserved for a later phase.';
comment on column public.professional_payout_profiles.account_reference_encrypted is 'Application-layer encrypted account reference. Never return to clients.';
