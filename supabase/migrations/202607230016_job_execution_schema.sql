-- Inspection, versioned quotations, materials, change orders, job evidence,
-- participant chat, and completion records.

create table public.job_inspections (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  findings text,
  recommended_work text,
  safety_notes text,
  status text not null default 'pending' check (status in ('not_required', 'pending', 'in_progress', 'completed', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_reference text not null unique default ('FMQ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  version_number integer not null check (version_number > 0),
  currency_code char(3) not null default 'PKR',
  labor_subtotal_minor bigint not null default 0 check (labor_subtotal_minor >= 0),
  materials_subtotal_minor bigint not null default 0 check (materials_subtotal_minor >= 0),
  other_subtotal_minor bigint not null default 0 check (other_subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  deposit_required_minor bigint not null default 0 check (deposit_required_minor >= 0),
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes between 15 and 43200),
  warranty_days integer not null default 0 check (warranty_days between 0 and 3650),
  terms text,
  exclusions text,
  notes text,
  valid_until timestamptz,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'revised', 'approved', 'rejected', 'expired', 'superseded', 'withdrawn')),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  superseded_at timestamptz,
  withdrawn_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, version_number),
  check (deposit_required_minor <= total_minor)
);

create table public.job_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.job_quotations(id) on delete cascade,
  item_type text not null check (item_type in ('labor', 'material', 'other', 'discount')),
  description text not null check (char_length(description) between 2 and 500),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'item' check (char_length(unit) between 1 and 40),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  amount_minor bigint not null check (amount_minor >= 0),
  material_source text check (material_source is null or material_source in ('professional', 'customer', 'mixed')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotation_decisions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.job_quotations(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected', 'revision_requested', 'clarification_requested')),
  reason text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index quotation_one_terminal_decision_idx
  on public.quotation_decisions (quotation_id)
  where decision in ('approved', 'rejected', 'revision_requested');

create table public.job_media (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  uploaded_by uuid not null references public.user_profiles(id) on delete restrict,
  media_stage text not null check (media_stage in (
    'before_work', 'inspection', 'during_work', 'material_receipt',
    'change_order_evidence', 'after_work', 'warranty_evidence', 'dispute_evidence'
  )),
  media_type text not null check (media_type in ('image', 'video', 'document')),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  caption text,
  taken_at timestamptz,
  latitude numeric(9,6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9,6) check (longitude is null or longitude between -180 and 180),
  customer_visible boolean not null default true,
  professional_visible boolean not null default true,
  admin_only boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.job_material_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  quotation_id uuid references public.job_quotations(id) on delete restrict,
  description text not null,
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null,
  material_source text not null default 'professional' check (material_source in ('professional', 'customer', 'mixed')),
  estimated_unit_cost_minor bigint not null default 0 check (estimated_unit_cost_minor >= 0),
  estimated_amount_minor bigint not null default 0 check (estimated_amount_minor >= 0),
  actual_unit_cost_minor bigint check (actual_unit_cost_minor is null or actual_unit_cost_minor >= 0),
  actual_amount_minor bigint check (actual_amount_minor is null or actual_amount_minor >= 0),
  purchase_status text not null default 'planned' check (purchase_status in ('planned', 'customer_supplying', 'purchased', 'used', 'returned', 'cancelled')),
  receipt_media_id uuid references public.job_media(id) on delete restrict,
  approved_by_customer boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_change_orders (
  id uuid primary key default gen_random_uuid(),
  change_order_reference text not null unique default ('FMC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null references public.jobs(id) on delete cascade,
  quotation_id uuid not null references public.job_quotations(id) on delete restrict,
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 1000),
  description text not null check (char_length(description) between 3 and 4000),
  evidence_summary text,
  currency_code char(3) not null default 'PKR',
  labor_change_minor bigint not null default 0,
  material_change_minor bigint not null default 0,
  other_change_minor bigint not null default 0,
  total_change_minor bigint not null default 0,
  schedule_change_minutes integer not null default 0 check (schedule_change_minutes between -43200 and 43200),
  emergency_safety_exception boolean not null default false,
  emergency_justification text,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected', 'withdrawn', 'superseded')),
  submitted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_change_minor = labor_change_minor + material_change_minor + other_change_minor),
  check (not emergency_safety_exception or nullif(trim(emergency_justification), '') is not null)
);

create unique index change_order_one_submitted_idx
  on public.job_change_orders (job_id)
  where status = 'submitted';

create table public.job_messages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  sender_user_id uuid references public.user_profiles(id) on delete set null,
  message_type text not null default 'text' check (message_type in ('text', 'system', 'attachment')),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to_message_id uuid references public.job_messages(id) on delete set null,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  moderation_status text not null default 'visible' check (moderation_status in ('visible', 'reported', 'hidden', 'removed')),
  metadata jsonb not null default '{}'::jsonb
);

create table public.job_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.job_messages(id) on delete cascade,
  job_media_id uuid references public.job_media(id) on delete restrict,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  created_at timestamptz not null default now()
);

create table public.job_message_reads (
  message_id uuid not null references public.job_messages(id) on delete cascade,
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.job_completions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  submitted_by_professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  professional_summary text not null check (char_length(professional_summary) between 10 and 5000),
  final_price_minor bigint not null check (final_price_minor >= 0),
  warranty_days integer not null default 0 check (warranty_days between 0 and 3650),
  outstanding_notes text,
  customer_notes text,
  customer_decision text not null default 'pending' check (customer_decision in ('pending', 'confirmed', 'issue_reported', 'disputed')),
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  auto_confirmation_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inspections_professional_status_idx on public.job_inspections (professional_id, status, updated_at desc);
create index quotations_job_version_idx on public.job_quotations (job_id, version_number desc);
create index quotations_customer_status_idx on public.job_quotations (customer_id, status, submitted_at desc);
create index quotation_items_quotation_idx on public.job_quotation_items (quotation_id, display_order);
create index material_items_job_idx on public.job_material_items (job_id, purchase_status);
create index change_orders_job_status_idx on public.job_change_orders (job_id, status, created_at desc);
create index job_media_job_stage_idx on public.job_media (job_id, media_stage, created_at desc) where deleted_at is null;
create index job_messages_job_sent_idx on public.job_messages (job_id, sent_at desc) where deleted_at is null;
create index message_reads_user_idx on public.job_message_reads (user_id, read_at desc);

create trigger set_job_inspections_updated_at before update on public.job_inspections
  for each row execute function public.set_updated_at();
create trigger set_job_quotations_updated_at before update on public.job_quotations
  for each row execute function public.set_updated_at();
create trigger set_job_quotation_items_updated_at before update on public.job_quotation_items
  for each row execute function public.set_updated_at();
create trigger set_job_material_items_updated_at before update on public.job_material_items
  for each row execute function public.set_updated_at();
create trigger set_job_change_orders_updated_at before update on public.job_change_orders
  for each row execute function public.set_updated_at();
create trigger set_job_completions_updated_at before update on public.job_completions
  for each row execute function public.set_updated_at();

insert into public.system_settings (key, value, is_public, description)
values
  ('phase2.quotation.validity_days', '7'::jsonb, false, 'Default quotation validity period.'),
  ('phase2.completion.auto_confirm_hours', '0'::jsonb, false, 'Zero disables completion auto-confirmation.'),
  ('phase2.chat.message_limit_5m', '30'::jsonb, false, 'Participant chat message limit per five minutes.'),
  ('phase2.job_media.max_bytes', '26214400'::jsonb, false, 'Maximum private job evidence object size.')
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-evidence',
  'job-evidence',
  false,
  26214400,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare v_table text;
begin
  foreach v_table in array array[
    'job_inspections', 'job_quotations', 'job_quotation_items', 'quotation_decisions',
    'job_media', 'job_material_items', 'job_change_orders', 'job_messages',
    'job_message_attachments', 'job_message_reads', 'job_completions'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end;
$$;

create policy inspections_participant_staff_read on public.job_inspections for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy quotations_participant_staff_read on public.job_quotations for select to authenticated
  using (customer_id = public.current_profile_id() or professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy quotation_items_participant_staff_read on public.job_quotation_items for select to authenticated
  using (exists (
    select 1 from public.job_quotations q where q.id = quotation_id
      and (q.customer_id = public.current_profile_id() or q.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy quotation_decisions_participant_staff_read on public.quotation_decisions for select to authenticated
  using (exists (
    select 1 from public.job_quotations q where q.id = quotation_id
      and (q.customer_id = public.current_profile_id() or q.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy job_media_participant_staff_read on public.job_media for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id and (
      (j.customer_id = public.current_profile_id() and customer_visible and not admin_only)
      or (j.professional_id = public.current_profile_id() and professional_visible and not admin_only)
      or public.is_admin() or public.has_role('support')
    )
  ));
create policy material_items_participant_staff_read on public.job_material_items for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy change_orders_participant_staff_read on public.job_change_orders for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy job_messages_participant_staff_read on public.job_messages for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy message_attachments_participant_staff_read on public.job_message_attachments for select to authenticated
  using (exists (
    select 1 from public.job_messages m join public.jobs j on j.id = m.job_id
    where m.id = message_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy message_reads_participant_staff_read on public.job_message_reads for select to authenticated
  using (exists (
    select 1 from public.job_messages m join public.jobs j on j.id = m.job_id
    where m.id = message_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy completions_participant_staff_read on public.job_completions for select to authenticated
  using (exists (
    select 1 from public.jobs j where j.id = job_id
      and (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));

revoke insert, update, delete on public.job_inspections from authenticated;
revoke insert, update, delete on public.job_quotations from authenticated;
revoke insert, update, delete on public.job_quotation_items from authenticated;
revoke insert, update, delete on public.quotation_decisions from authenticated;
revoke insert, update, delete on public.job_media from authenticated;
revoke insert, update, delete on public.job_material_items from authenticated;
revoke insert, update, delete on public.job_change_orders from authenticated;
revoke insert, update, delete on public.job_messages from authenticated;
revoke insert, update, delete on public.job_message_attachments from authenticated;
revoke insert, update, delete on public.job_message_reads from authenticated;
revoke insert, update, delete on public.job_completions from authenticated;
