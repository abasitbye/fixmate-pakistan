create or replace function public.set_user_account_status(target_profile_id uuid, target_status public.account_status, reason text default null)
returns public.user_profiles language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := public.current_profile_id(); actor_super boolean := public.has_role('super_admin'); target_is_super boolean; before_status public.account_status; result public.user_profiles;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  select public.has_role('super_admin') from public.user_profiles where id = actor_id into actor_super;
  select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_profile_id=target_profile_id and ur.is_active and r.code='super_admin') into target_is_super;
  if target_is_super and not actor_super then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if target_status='suspended' and nullif(trim(coalesce(reason,'')),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select account_status into before_status from public.user_profiles where id=target_profile_id for update;
  update public.user_profiles set account_status=target_status,suspension_reason=case when target_status='suspended' then reason else null end where id=target_profile_id returning * into result;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.audit_logs(actor_user_profile_id,actor_auth_user_id,action,entity_type,entity_id,before_data,after_data)
  values(actor_id,auth.uid(),'user.account_status','user_profile',target_profile_id::text,jsonb_build_object('status',before_status),jsonb_build_object('status',target_status,'reason',reason));
  return result;
end; $$;

create or replace function public.set_user_role(target_profile_id uuid, target_role text, active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := public.current_profile_id(); role_id uuid;
begin
  if not public.has_role('super_admin') then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  select id into role_id from public.roles where code=target_role;
  if role_id is null then raise exception 'ROLE_NOT_FOUND'; end if;
  if target_role='customer' and not active then raise exception 'CUSTOMER_ROLE_REQUIRED'; end if;
  insert into public.user_roles(user_profile_id,role_id,is_active,granted_by,revoked_at)
  values(target_profile_id,role_id,active,actor_id,case when active then null else now() end)
  on conflict(user_profile_id,role_id) do update set is_active=excluded.is_active,granted_by=actor_id,granted_at=now(),revoked_at=excluded.revoked_at;
  insert into public.audit_logs(actor_user_profile_id,actor_auth_user_id,action,entity_type,entity_id,after_data)
  values(actor_id,auth.uid(),'user.role_change','user_profile',target_profile_id::text,jsonb_build_object('role',target_role,'active',active));
end; $$;

create or replace function public.set_professional_verification(target_professional_id uuid,target_verification_type_id uuid,target_status public.verification_status,verification_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_id uuid := public.current_profile_id();
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  insert into public.professional_verifications(professional_profile_id,verification_type_id,status,notes,verified_by,verified_at)
  values(target_professional_id,target_verification_type_id,target_status,verification_notes,actor_id,case when target_status='verified' then now() else null end)
  on conflict(professional_profile_id,verification_type_id) do update set status=excluded.status,notes=excluded.notes,verified_by=actor_id,verified_at=excluded.verified_at;
  insert into public.audit_logs(actor_user_profile_id,actor_auth_user_id,action,entity_type,entity_id,after_data)
  values(actor_id,auth.uid(),'professional.verification','professional_profile',target_professional_id::text,jsonb_build_object('verification_type_id',target_verification_type_id,'status',target_status,'notes',verification_notes));
end; $$;

grant execute on function public.set_user_account_status(uuid,public.account_status,text) to authenticated;
grant execute on function public.set_user_role(uuid,text,boolean) to authenticated;
grant execute on function public.set_professional_verification(uuid,uuid,public.verification_status,text) to authenticated;
