create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid references public.user_profiles(id) on delete set null,
  name text not null,
  email citext not null,
  subject text not null,
  message text not null,
  status text not null default 'new' check (status in ('new','in_progress','resolved','spam')),
  assigned_to uuid references public.user_profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_contact_messages_updated_at before update on public.contact_messages
  for each row execute function public.set_updated_at();
create index contact_messages_status_created_idx on public.contact_messages (status, created_at desc);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
comment on table public.contact_messages is 'Abuse-protected public support intake; accessed only through server-authorized APIs.';
