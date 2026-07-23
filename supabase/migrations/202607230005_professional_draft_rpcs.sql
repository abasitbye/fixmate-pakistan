create or replace function public.assert_editable_professional_application()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare profile_id uuid := public.current_profile_id();
begin
  if profile_id is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists (
    select 1 from public.professional_profiles
    where user_profile_id = profile_id and application_status in ('draft','changes_requested')
  ) then raise exception 'APPLICATION_NOT_EDITABLE'; end if;
  return profile_id;
end;
$$;

create or replace function public.replace_professional_services(subcategory_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare profile_id uuid := public.assert_editable_professional_application(); valid_count integer;
begin
  if cardinality(subcategory_ids) < 1 or cardinality(subcategory_ids) > 30 then raise exception 'INVALID_SERVICE_COUNT'; end if;
  select count(*) into valid_count from public.service_subcategories where id = any(subcategory_ids) and is_active;
  if valid_count <> cardinality(subcategory_ids) then raise exception 'INVALID_SERVICE_SELECTION'; end if;
  delete from public.professional_services where professional_profile_id = profile_id;
  insert into public.professional_services (professional_profile_id, service_subcategory_id)
  select profile_id, value from unnest(subcategory_ids) value;
end; $$;

create or replace function public.replace_professional_service_areas(zone_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare profile_id uuid := public.assert_editable_professional_application(); valid_count integer;
begin
  if cardinality(zone_ids) < 1 or cardinality(zone_ids) > 30 then raise exception 'INVALID_AREA_COUNT'; end if;
  select count(*) into valid_count from public.service_zones where id = any(zone_ids) and is_active;
  if valid_count <> cardinality(zone_ids) then raise exception 'INVALID_AREA_SELECTION'; end if;
  delete from public.professional_service_areas where professional_profile_id = profile_id;
  insert into public.professional_service_areas (professional_profile_id, service_zone_id)
  select profile_id, value from unnest(zone_ids) value;
end; $$;

create or replace function public.replace_professional_availability(entries jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_id uuid := public.assert_editable_professional_application(); entry jsonb;
begin
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) < 1 or jsonb_array_length(entries) > 14 then raise exception 'INVALID_AVAILABILITY'; end if;
  delete from public.professional_availability_schedules where professional_profile_id = profile_id;
  for entry in select * from jsonb_array_elements(entries)
  loop
    if (entry->>'dayOfWeek')::integer not between 0 and 6
      or (entry->>'startTime')::time >= (entry->>'endTime')::time then raise exception 'INVALID_AVAILABILITY_ENTRY'; end if;
    insert into public.professional_availability_schedules (professional_profile_id, day_of_week, start_time, end_time, is_active)
    values (profile_id, (entry->>'dayOfWeek')::integer, (entry->>'startTime')::time, (entry->>'endTime')::time, coalesce((entry->>'isActive')::boolean, true));
  end loop;
end; $$;

create or replace function public.replace_professional_references(entries jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare profile_id uuid := public.assert_editable_professional_application(); entry jsonb;
begin
  if jsonb_typeof(entries) <> 'array' or jsonb_array_length(entries) < 2 or jsonb_array_length(entries) > 4 then raise exception 'INVALID_REFERENCE_COUNT'; end if;
  delete from public.professional_references where professional_profile_id = profile_id;
  for entry in select * from jsonb_array_elements(entries)
  loop
    insert into public.professional_references (professional_profile_id, full_name, relationship, phone, notes)
    values (profile_id, entry->>'fullName', entry->>'relationship', entry->>'phone', nullif(entry->>'notes',''));
  end loop;
end; $$;

grant execute on function public.assert_editable_professional_application() to authenticated;
grant execute on function public.replace_professional_services(uuid[]) to authenticated;
grant execute on function public.replace_professional_service_areas(uuid[]) to authenticated;
grant execute on function public.replace_professional_availability(jsonb) to authenticated;
grant execute on function public.replace_professional_references(jsonb) to authenticated;
