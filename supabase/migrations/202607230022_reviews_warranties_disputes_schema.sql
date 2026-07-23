-- Phase 2 Checkpoint 7: reviews, warranties, claims, disputes, evidence, and consequences.

create table public.job_reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  reviewer_user_id uuid not null references public.user_profiles(id) on delete restrict,
  reviewee_user_id uuid not null references public.user_profiles(id) on delete restrict,
  reviewer_role text not null check (reviewer_role in ('customer', 'professional')),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_quality smallint check (rating_quality between 1 and 5),
  rating_timeliness smallint check (rating_timeliness between 1 and 5),
  rating_communication smallint check (rating_communication between 1 and 5),
  rating_value smallint check (rating_value between 1 and 5),
  comment text check (comment is null or char_length(comment) between 3 and 3000),
  status text not null default 'pending' check (status in ('pending', 'published', 'hidden', 'under_review', 'removed')),
  moderation_reason text,
  moderated_by uuid references public.user_profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (job_id, reviewer_user_id),
  check (reviewer_user_id <> reviewee_user_id)
);

create table public.professional_rating_aggregates (
  professional_id uuid primary key references public.professional_profiles(user_profile_id) on delete restrict,
  published_review_count integer not null default 0 check (published_review_count >= 0),
  rating_overall numeric(3,2),
  rating_quality numeric(3,2),
  rating_timeliness numeric(3,2),
  rating_communication numeric(3,2),
  rating_value numeric(3,2),
  is_new_professional boolean not null default true,
  recalculated_at timestamptz not null default now()
);

create table public.job_warranties (
  id uuid primary key default gen_random_uuid(),
  warranty_reference text not null unique default ('FMW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  quotation_id uuid not null references public.job_quotations(id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  coverage_description text not null,
  excluded_items text,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'voided', 'claim_open', 'fulfilled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at)
);

create table public.warranty_claims (
  id uuid primary key default gen_random_uuid(),
  claim_reference text not null unique default ('FMWC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  warranty_id uuid not null references public.job_warranties(id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  description text not null check (char_length(description) between 10 and 4000),
  status text not null default 'submitted' check (status in (
    'submitted', 'under_review', 'professional_response_requested', 'revisit_scheduled',
    'remedial_work_in_progress', 'resolved', 'rejected', 'escalated_to_dispute', 'cancelled'
  )),
  professional_response text,
  submitted_at timestamptz not null default now(),
  professional_response_due_at timestamptz,
  scheduled_revisit_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index warranty_claim_one_active_idx on public.warranty_claims (warranty_id)
  where status in ('submitted', 'under_review', 'professional_response_requested', 'revisit_scheduled', 'remedial_work_in_progress');

create table public.warranty_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.warranty_claims(id) on delete restrict,
  submitted_by uuid not null references public.user_profiles(id) on delete restrict,
  evidence_type text not null check (evidence_type in ('image', 'video', 'document')),
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  description text check (description is null or char_length(description) <= 1000),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.job_disputes (
  id uuid primary key default gen_random_uuid(),
  dispute_reference text not null unique default ('FMD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null references public.jobs(id) on delete restrict,
  opened_by uuid not null references public.user_profiles(id) on delete restrict,
  reason_category text not null check (reason_category in (
    'professional_no_show', 'customer_no_show', 'incomplete_work', 'poor_workmanship',
    'property_damage', 'unauthorized_work', 'unapproved_material_charge', 'payment_disagreement',
    'refund_disagreement', 'harassment_misconduct', 'safety_concern', 'warranty_failure', 'other'
  )),
  description text not null check (char_length(description) between 10 and 5000),
  requested_resolution text not null check (char_length(requested_resolution) between 3 and 2000),
  contact_preference text not null default 'in_app' check (contact_preference in ('in_app', 'email', 'phone')),
  status text not null default 'open' check (status in (
    'open', 'awaiting_customer', 'awaiting_professional', 'under_review', 'mediation',
    'resolution_proposed', 'resolved', 'rejected', 'closed', 'reopened'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references public.user_profiles(id) on delete set null,
  payment_hold_amount_minor bigint not null default 0 check (payment_hold_amount_minor >= 0),
  opened_at timestamptz not null default now(),
  response_due_at timestamptz,
  resolved_at timestamptz,
  resolution_type text,
  resolution_summary text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index disputes_one_active_category_idx on public.job_disputes (job_id, reason_category)
  where status not in ('resolved', 'rejected', 'closed');

create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.job_disputes(id) on delete restrict,
  submitted_by uuid not null references public.user_profiles(id) on delete restrict,
  evidence_type text not null check (evidence_type in ('image', 'video', 'document', 'job_record_reference')),
  storage_path text,
  description text not null check (char_length(description) between 3 and 2000),
  submitted_at timestamptz not null default now(),
  visibility text not null default 'shared' check (visibility in ('shared', 'customer_only', 'professional_only', 'internal_staff')),
  redacted_at timestamptz,
  redacted_by uuid references public.user_profiles(id) on delete set null,
  redaction_reason text,
  created_at timestamptz not null default now(),
  check (evidence_type = 'job_record_reference' or storage_path is not null)
);

create table public.dispute_messages (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.job_disputes(id) on delete restrict,
  sender_user_id uuid not null references public.user_profiles(id) on delete restrict,
  sender_role text not null check (sender_role in ('customer', 'professional', 'support', 'admin', 'super_admin')),
  body text not null check (char_length(body) between 1 and 4000),
  visibility text not null default 'shared' check (visibility in ('shared', 'customer_only', 'professional_only', 'internal_staff')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.dispute_decisions (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.job_disputes(id) on delete restrict,
  decided_by uuid not null references public.user_profiles(id) on delete restrict,
  decision_type text not null check (decision_type in (
    'no_action', 'rework', 'reschedule', 'partial_refund', 'full_refund',
    'partial_professional_payment', 'full_professional_payment', 'platform_fee_waiver',
    'account_warning', 'suspension', 'permanent_restriction', 'external_referral'
  )),
  customer_refund_minor bigint not null default 0 check (customer_refund_minor >= 0),
  professional_release_minor bigint not null default 0 check (professional_release_minor >= 0),
  platform_fee_adjustment_minor bigint not null default 0,
  account_action text,
  reason text not null check (char_length(reason) between 10 and 5000),
  created_at timestamptz not null default now()
);

create table public.dispute_status_history (
  id bigint generated always as identity primary key,
  dispute_id uuid not null references public.job_disputes(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_user_id uuid references public.user_profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table public.marketplace_account_actions (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.job_disputes(id) on delete restrict,
  target_user_id uuid not null references public.user_profiles(id) on delete restrict,
  action_type text not null check (action_type in ('warning', 'suspension', 'permanent_restriction', 'external_referral')),
  reason text not null check (char_length(reason) between 10 and 5000),
  applied_by uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.refunds
  add constraint refunds_dispute_fk foreign key (dispute_id) references public.job_disputes(id) on delete restrict;

create index reviews_reviewee_status_idx on public.job_reviews (reviewee_user_id, status, published_at desc);
create index warranties_owner_status_idx on public.job_warranties (customer_id, status, expires_at);
create index warranty_claims_party_status_idx on public.warranty_claims (customer_id, professional_id, status, created_at desc);
create index disputes_job_status_idx on public.job_disputes (job_id, status, created_at desc);
create index dispute_messages_case_idx on public.dispute_messages (dispute_id, created_at);
create index dispute_evidence_case_idx on public.dispute_evidence (dispute_id, submitted_at);

create trigger set_job_reviews_updated_at before update on public.job_reviews for each row execute function public.set_updated_at();
create trigger set_job_warranties_updated_at before update on public.job_warranties for each row execute function public.set_updated_at();
create trigger set_warranty_claims_updated_at before update on public.warranty_claims for each row execute function public.set_updated_at();
create trigger set_job_disputes_updated_at before update on public.job_disputes for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'job_reviews', 'professional_rating_aggregates', 'job_warranties', 'warranty_claims',
    'warranty_claim_evidence', 'job_disputes', 'dispute_evidence', 'dispute_messages',
    'dispute_decisions', 'dispute_status_history', 'marketplace_account_actions'
  ] loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;

create policy reviews_participant_staff_read on public.job_reviews for select to authenticated
  using (status = 'published' or reviewer_user_id = public.current_profile_id() or reviewee_user_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy rating_aggregates_authenticated_read on public.professional_rating_aggregates for select to authenticated using (true);
create policy warranties_participant_staff_read on public.job_warranties for select to authenticated
  using (customer_id = public.current_profile_id() or professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy claims_participant_staff_read on public.warranty_claims for select to authenticated
  using (customer_id = public.current_profile_id() or professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy claim_evidence_participant_staff_read on public.warranty_claim_evidence for select to authenticated
  using (exists (select 1 from public.warranty_claims c where c.id = claim_id and
    (c.customer_id = public.current_profile_id() or c.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))));
create policy disputes_participant_staff_read on public.job_disputes for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and
    (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))));
create policy dispute_evidence_visibility_read on public.dispute_evidence for select to authenticated
  using (redacted_at is null and exists (
    select 1 from public.job_disputes d join public.jobs j on j.id = d.job_id
    where d.id = dispute_id and (
      public.is_admin() or public.has_role('support')
      or (j.customer_id = public.current_profile_id() and visibility in ('shared', 'customer_only'))
      or (j.professional_id = public.current_profile_id() and visibility in ('shared', 'professional_only'))
    )
  ));
create policy dispute_messages_visibility_read on public.dispute_messages for select to authenticated
  using (exists (
    select 1 from public.job_disputes d join public.jobs j on j.id = d.job_id
    where d.id = dispute_id and (
      public.is_admin() or public.has_role('support')
      or (j.customer_id = public.current_profile_id() and visibility in ('shared', 'customer_only'))
      or (j.professional_id = public.current_profile_id() and visibility in ('shared', 'professional_only'))
    )
  ));
create policy dispute_decisions_participant_staff_read on public.dispute_decisions for select to authenticated
  using (exists (select 1 from public.job_disputes d join public.jobs j on j.id = d.job_id where d.id = dispute_id and
    (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))));
create policy dispute_history_participant_staff_read on public.dispute_status_history for select to authenticated
  using (exists (select 1 from public.job_disputes d join public.jobs j on j.id = d.job_id where d.id = dispute_id and
    (j.customer_id = public.current_profile_id() or j.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))));
create policy account_actions_target_staff_read on public.marketplace_account_actions for select to authenticated
  using (target_user_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));

grant select on public.job_reviews, public.professional_rating_aggregates, public.job_warranties,
  public.warranty_claims, public.warranty_claim_evidence, public.job_disputes, public.dispute_evidence,
  public.dispute_messages, public.dispute_decisions, public.dispute_status_history,
  public.marketplace_account_actions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resolution-evidence', 'resolution-evidence', false, 26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']::text[]
)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.system_settings (key, value, is_public, description)
values
  ('phase2.resolution_enabled', 'false'::jsonb, true, 'Reviews, warranties, claims, and dispute resolution release control.'),
  ('reviews.minimum_public_count', '1'::jsonb, true, 'Minimum published review count before an aggregate is shown.'),
  ('warranty.professional_response_hours', '48'::jsonb, false, 'Default professional response deadline for warranty claims.'),
  ('disputes.default_response_hours', '48'::jsonb, false, 'Default participant response deadline for disputes.')
on conflict (key) do nothing;
