-- Repair authentication users created before the profile-provisioning trigger existed.
-- Keep provisioning idempotent so OTP verification can safely recover a partially
-- provisioned account without weakening account-status enforcement.

create or replace function public.provision_auth_user_profile(
  target_auth_user_id uuid,
  target_email text,
  target_metadata jsonb default '{}'::jsonb
)
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile public.user_profiles;
  customer_role_id uuid;
begin
  if target_auth_user_id is null then
    raise exception 'Authentication user is required';
  end if;

  insert into public.user_profiles (auth_user_id, email, display_name)
  values (
    target_auth_user_id,
    coalesce(nullif(trim(target_email), ''), target_auth_user_id::text || '@pending.fixmate.local'),
    nullif(trim(coalesce(target_metadata ->> 'display_name', '')), '')
  )
  on conflict (auth_user_id) do update
    set email = excluded.email
  returning * into profile;

  select id into customer_role_id
  from public.roles
  where code = 'customer';

  if customer_role_id is not null then
    insert into public.user_roles (user_profile_id, role_id)
    values (profile.id, customer_role_id)
    on conflict do nothing;
  end if;

  insert into public.customer_profiles (user_profile_id)
  values (profile.id)
  on conflict do nothing;

  insert into public.notification_preferences (user_profile_id)
  values (profile.id)
  on conflict do nothing;

  return profile;
end;
$$;

revoke all on function public.provision_auth_user_profile(uuid, text, jsonb) from public;
revoke all on function public.provision_auth_user_profile(uuid, text, jsonb) from anon;
revoke all on function public.provision_auth_user_profile(uuid, text, jsonb) from authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.provision_auth_user_profile(
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  );
  return new;
end;
$$;

create or replace function public.ensure_current_user_profile()
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user auth.users;
begin
  select *
  into auth_user
  from auth.users
  where id = auth.uid();

  if auth_user.id is null then
    raise exception 'Authenticated user was not found';
  end if;

  return public.provision_auth_user_profile(
    auth_user.id,
    auth_user.email,
    coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.ensure_current_user_profile() from public;
revoke all on function public.ensure_current_user_profile() from anon;
grant execute on function public.ensure_current_user_profile() to authenticated;

do $$
declare
  auth_user auth.users;
begin
  for auth_user in
    select *
    from auth.users
  loop
    perform public.provision_auth_user_profile(
      auth_user.id,
      auth_user.email,
      coalesce(auth_user.raw_user_meta_data, '{}'::jsonb)
    );
  end loop;
end;
$$;
