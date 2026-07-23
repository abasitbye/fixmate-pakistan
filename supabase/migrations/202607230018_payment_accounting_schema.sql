-- FixMate Pakistan Phase 2: provider-neutral payments and auditable marketplace accounting.
-- Financial amounts are integer minor units. No raw card, bank, wallet, PIN, CVV,
-- password, or online-banking credential is permitted in these tables.

create table public.customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  method_type text not null check (method_type in ('cash', 'manual_bank_transfer', 'raast', 'mobile_wallet', 'online_gateway')),
  provider_reference text,
  masked_display text not null check (char_length(masked_display) between 2 and 120),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index customer_payment_methods_default_idx
  on public.customer_payment_methods (customer_id)
  where is_default and status = 'active' and deleted_at is null;

create table public.fee_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  scope text not null default 'platform_commission'
    check (scope in ('platform_commission', 'cancellation', 'refund_adjustment')),
  service_category_id uuid references public.service_categories(id) on delete restrict,
  city_id uuid references public.cities(id) on delete restrict,
  currency_code char(3) not null default 'PKR' check (currency_code ~ '^[A-Z]{3}$'),
  fee_type text not null check (fee_type in ('percentage', 'fixed', 'percentage_plus_fixed')),
  percentage_basis_points integer not null default 0 check (percentage_basis_points between 0 and 10000),
  fixed_amount_minor bigint not null default 0 check (fixed_amount_minor >= 0),
  minimum_fee_minor bigint check (minimum_fee_minor is null or minimum_fee_minor >= 0),
  maximum_fee_minor bigint check (maximum_fee_minor is null or maximum_fee_minor >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  check (maximum_fee_minor is null or minimum_fee_minor is null or maximum_fee_minor >= minimum_fee_minor)
);

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  payment_reference text not null unique default ('FMP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null references public.jobs(id) on delete restrict,
  customer_id uuid not null references public.customer_profiles(user_profile_id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  payment_method_id uuid references public.customer_payment_methods(id) on delete restrict,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  method_type text not null check (method_type in ('cash', 'manual_bank_transfer', 'raast', 'mobile_wallet', 'online_gateway')),
  currency_code char(3) not null default 'PKR' check (currency_code ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  professional_amount_minor bigint not null check (professional_amount_minor >= 0),
  fee_rule_id uuid references public.fee_rules(id) on delete restrict,
  status text not null check (status in (
    'created', 'pending', 'requires_action', 'authorized', 'paid', 'failed',
    'cancelled', 'partially_refunded', 'refunded', 'cash_due', 'cash_reported', 'cash_disputed', 'cash_confirmed'
  )),
  provider_reference text,
  idempotency_key text not null,
  expires_at timestamptz,
  paid_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  check (professional_amount_minor + platform_fee_minor = amount_minor)
);

create unique index payment_intents_one_open_job_idx
  on public.payment_intents (job_id)
  where status in ('created', 'pending', 'requires_action', 'authorized', 'cash_due', 'cash_reported', 'cash_disputed');

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'authorization', 'capture', 'payment', 'cash_report', 'cash_confirmation',
    'refund', 'partial_refund', 'reversal', 'adjustment'
  )),
  provider text not null,
  provider_transaction_id text,
  currency_code char(3) not null default 'PKR',
  amount_minor bigint not null check (amount_minor > 0),
  status text not null check (status in ('pending', 'succeeded', 'failed', 'reversed', 'requires_review')),
  failure_code text,
  failure_message_safe text,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index payment_transactions_provider_unique_idx
  on public.payment_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  signature_verified boolean not null default false,
  event_type text not null,
  payload_hash text not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  account_code text not null,
  account_name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  owner_type text not null default 'platform' check (owner_type in ('platform', 'customer', 'professional')),
  owner_profile_id uuid references public.user_profiles(id) on delete restrict,
  currency_code char(3) not null default 'PKR',
  status text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at timestamptz not null default now(),
  unique (account_code, owner_type, owner_profile_id, currency_code),
  check ((owner_type = 'platform' and owner_profile_id is null) or (owner_type <> 'platform' and owner_profile_id is not null))
);

create table public.ledger_entries (
  id bigint generated always as identity primary key,
  journal_id uuid not null,
  account_id uuid not null references public.ledger_accounts(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  refund_id uuid,
  payout_id uuid,
  direction text not null check (direction in ('debit', 'credit')),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'PKR',
  entry_type text not null check (entry_type in (
    'customer_receivable', 'cash_collected', 'provider_payment_received',
    'platform_fee_earned', 'professional_payable', 'refund_liability',
    'dispute_hold', 'payout', 'manual_adjustment'
  )),
  description text not null check (char_length(description) between 3 and 500),
  reversal_of_entry_id bigint references public.ledger_entries(id) on delete restrict,
  created_by uuid references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.professional_earnings (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  job_id uuid not null references public.jobs(id) on delete restrict,
  payment_intent_id uuid not null unique references public.payment_intents(id) on delete restrict,
  currency_code char(3) not null default 'PKR',
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  adjustment_minor bigint not null default 0,
  net_amount_minor bigint not null check (net_amount_minor >= 0),
  requires_payout boolean not null default true,
  status text not null check (status in ('pending', 'held', 'available', 'scheduled', 'paid', 'reversed')),
  available_at timestamptz,
  held_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_amount_minor = gross_amount_minor - platform_fee_minor + adjustment_minor)
);

create table public.professional_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_reference text not null unique default ('FMO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  professional_id uuid not null references public.professional_profiles(user_profile_id) on delete restrict,
  payout_account_id uuid not null references public.professional_payout_profiles(professional_profile_id) on delete restrict,
  provider text not null default 'manual',
  currency_code char(3) not null default 'PKR',
  amount_minor bigint not null check (amount_minor > 0),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'processing', 'paid', 'failed', 'cancelled', 'reversed')),
  provider_reference text,
  evidence_storage_path text,
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  approved_by uuid references public.user_profiles(id) on delete restrict,
  scheduled_at timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  failure_reason_safe text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requested_by, idempotency_key),
  check (approved_by is null or approved_by <> requested_by)
);

create table public.payout_earning_items (
  payout_id uuid not null references public.professional_payouts(id) on delete restrict,
  earning_id uuid not null unique references public.professional_earnings(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now(),
  primary key (payout_id, earning_id)
);

create table public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete restrict,
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  document_type text not null check (document_type in (
    'customer_receipt', 'customer_invoice', 'professional_earnings_statement', 'refund_receipt', 'payout_statement'
  )),
  document_number text not null unique,
  currency_code char(3) not null default 'PKR',
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  fees_minor bigint not null default 0 check (fees_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  issued_to_user_id uuid not null references public.user_profiles(id) on delete restrict,
  storage_path text,
  wording text not null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (total_minor = subtotal_minor + tax_minor)
);

create sequence public.financial_document_number_seq;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  refund_reference text not null unique default ('FMRF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  job_id uuid not null references public.jobs(id) on delete restrict,
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  dispute_id uuid,
  currency_code char(3) not null default 'PKR',
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null check (char_length(reason) between 5 and 2000),
  provider text not null,
  provider_reference text,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'processing', 'completed', 'failed', 'rejected', 'cancelled')),
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  approved_by uuid references public.user_profiles(id) on delete restrict,
  processed_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requested_by, idempotency_key)
);

alter table public.ledger_entries
  add constraint ledger_entries_refund_fk foreign key (refund_id) references public.refunds(id) on delete restrict,
  add constraint ledger_entries_payout_fk foreign key (payout_id) references public.professional_payouts(id) on delete restrict;

create table public.payment_reconciliation_cases (
  id uuid primary key default gen_random_uuid(),
  payment_intent_id uuid not null references public.payment_intents(id) on delete restrict,
  opened_by uuid not null references public.user_profiles(id) on delete restrict,
  assigned_to uuid references public.user_profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 2000),
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'rejected')),
  resolution text,
  evidence_reference text,
  resolved_by uuid references public.user_profiles(id) on delete restrict,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_intents_job_idx on public.payment_intents (job_id, created_at desc);
create index payment_transactions_intent_idx on public.payment_transactions (payment_intent_id, created_at);
create index ledger_entries_journal_idx on public.ledger_entries (journal_id, id);
create index ledger_entries_account_idx on public.ledger_entries (account_id, created_at desc);
create index professional_earnings_owner_idx on public.professional_earnings (professional_id, status, available_at);
create index professional_payouts_owner_idx on public.professional_payouts (professional_id, status, created_at desc);
create index refunds_intent_idx on public.refunds (payment_intent_id, created_at desc);
create index reconciliation_status_idx on public.payment_reconciliation_cases (status, created_at desc);

create trigger set_customer_payment_methods_updated_at before update on public.customer_payment_methods
  for each row execute function public.set_updated_at();
create trigger set_fee_rules_updated_at before update on public.fee_rules
  for each row execute function public.set_updated_at();
create trigger set_payment_intents_updated_at before update on public.payment_intents
  for each row execute function public.set_updated_at();
create trigger set_professional_earnings_updated_at before update on public.professional_earnings
  for each row execute function public.set_updated_at();
create trigger set_professional_payouts_updated_at before update on public.professional_payouts
  for each row execute function public.set_updated_at();
create trigger set_refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();
create trigger set_payment_reconciliation_cases_updated_at before update on public.payment_reconciliation_cases
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'customer_payment_methods', 'fee_rules', 'payment_intents', 'payment_transactions',
    'payment_webhook_events', 'ledger_accounts', 'ledger_entries', 'professional_earnings',
    'professional_payouts', 'payout_earning_items', 'transaction_documents', 'refunds',
    'payment_reconciliation_cases'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy payment_methods_owner_staff_read on public.customer_payment_methods for select to authenticated
  using (customer_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy payment_intents_participant_staff_read on public.payment_intents for select to authenticated
  using (customer_id = public.current_profile_id() or professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy payment_transactions_participant_staff_read on public.payment_transactions for select to authenticated
  using (exists (
    select 1 from public.payment_intents p where p.id = payment_intent_id
      and (p.customer_id = public.current_profile_id() or p.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy earnings_owner_staff_read on public.professional_earnings for select to authenticated
  using (professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy payouts_owner_staff_read on public.professional_payouts for select to authenticated
  using (professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy payout_items_owner_staff_read on public.payout_earning_items for select to authenticated
  using (exists (
    select 1 from public.professional_payouts p where p.id = payout_id
      and (p.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy documents_recipient_staff_read on public.transaction_documents for select to authenticated
  using (issued_to_user_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy refunds_participant_staff_read on public.refunds for select to authenticated
  using (exists (
    select 1 from public.payment_intents p where p.id = payment_intent_id
      and (p.customer_id = public.current_profile_id() or p.professional_id = public.current_profile_id() or public.is_admin() or public.has_role('support'))
  ));
create policy reconciliation_staff_read on public.payment_reconciliation_cases for select to authenticated
  using (public.is_admin() or public.has_role('support'));
create policy fee_rules_authenticated_read on public.fee_rules for select to authenticated using (true);
create policy ledger_accounts_owner_staff_read on public.ledger_accounts for select to authenticated
  using (owner_profile_id = public.current_profile_id() or public.is_admin() or public.has_role('support'));
create policy ledger_entries_owner_staff_read on public.ledger_entries for select to authenticated
  using (public.is_admin() or public.has_role('support') or exists (
    select 1 from public.ledger_accounts a where a.id = account_id and a.owner_profile_id = public.current_profile_id()
  ));

-- Webhook event bodies and platform-owned journals remain service-role/staff
-- operational data. All mutations use controlled command functions.
revoke all on public.payment_webhook_events from anon, authenticated;
grant select on public.customer_payment_methods, public.fee_rules, public.payment_intents,
  public.payment_transactions, public.ledger_accounts, public.ledger_entries,
  public.professional_earnings, public.professional_payouts, public.payout_earning_items,
  public.transaction_documents, public.refunds, public.payment_reconciliation_cases to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'financial-evidence', 'financial-evidence', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.system_settings (key, value, is_public, description)
values
  ('payments.online_providers_enabled', '[]'::jsonb, false, 'Online providers verified and enabled for payment processing. Empty until credentials, webhooks, and provider approval are complete.'),
  ('payments.cash_manual_enabled', 'true'::jsonb, false, 'Allow controlled cash and manual-transfer acknowledgements.'),
  ('payments.currency_code', '"PKR"'::jsonb, true, 'Marketplace settlement currency.'),
  ('payments.tax_configuration', 'null'::jsonb, false, 'Authorized tax configuration. Null means no tax calculation or tax-invoice label.')
on conflict (key) do nothing;

comment on table public.ledger_entries is 'Append-only double-entry journal lines. Corrections use reversal entries; completed lines are never edited.';
comment on table public.transaction_documents is 'Accurate payment acknowledgements/statements. Tax invoice wording is prohibited unless separately configured.';
