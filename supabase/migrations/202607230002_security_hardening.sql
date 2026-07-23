-- Narrow authenticated access to server-controlled and sensitive fields.

revoke insert, update on public.professional_profiles from authenticated;
grant insert (
  user_profile_id, business_name, cnic_last4, years_experience, bio,
  primary_city_id, travel_radius_km, has_tools, has_transport
) on public.professional_profiles to authenticated;
grant update (
  business_name, cnic_last4, years_experience, bio,
  primary_city_id, travel_radius_km, has_tools, has_transport
) on public.professional_profiles to authenticated;

revoke insert, update on public.professional_references from authenticated;
grant insert (
  professional_profile_id, full_name, relationship, phone, notes
) on public.professional_references to authenticated;
grant update (full_name, relationship, phone, notes)
  on public.professional_references to authenticated;

revoke insert, update on public.professional_documents from authenticated;
grant insert (
  professional_profile_id, verification_type_id, storage_path,
  original_file_name, mime_type, size_bytes, expires_at
) on public.professional_documents to authenticated;
grant update (
  verification_type_id, storage_path, original_file_name, mime_type, size_bytes, expires_at
) on public.professional_documents to authenticated;

revoke all on public.professional_payout_profiles from anon, authenticated;
grant select on public.professional_payout_profiles to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at, delivery_status) on public.notifications to authenticated;

revoke insert, update, delete on public.roles from anon, authenticated;
revoke insert, update, delete on public.user_roles from anon, authenticated;
revoke insert, update, delete on public.verification_types from anon, authenticated;
revoke insert, update, delete on public.consent_types from anon, authenticated;
revoke insert, update, delete on public.system_settings from anon, authenticated;

grant select on public.countries, public.provinces, public.cities,
  public.service_zones, public.service_categories, public.service_subcategories,
  public.consent_types to anon, authenticated;
grant select on public.verification_types, public.roles to authenticated;

create or replace function public.create_professional_draft()
returns public.professional_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_id uuid := public.current_profile_id();
  application public.professional_profiles;
begin
  if profile_id is null then raise exception 'UNAUTHENTICATED'; end if;

  insert into public.professional_profiles (user_profile_id)
  values (profile_id)
  on conflict (user_profile_id) do nothing;

  select * into application
  from public.professional_profiles
  where user_profile_id = profile_id;

  return application;
end;
$$;

create or replace function public.mark_notification_read(target_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now()), delivery_status = 'read'
  where id = target_notification_id
    and user_profile_id = public.current_profile_id();

  if not found then raise exception 'NOTIFICATION_NOT_FOUND'; end if;
end;
$$;

grant execute on function public.create_professional_draft() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

comment on function public.create_professional_draft() is 'Creates only a Draft application for the authenticated profile.';
comment on function public.mark_notification_read(uuid) is 'Marks only an authenticated user owned notification as read.';
