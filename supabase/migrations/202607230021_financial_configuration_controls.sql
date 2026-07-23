-- Tighten payout-data projection and make high-risk fee changes atomic/audited.

alter table public.professional_payout_profiles
  drop constraint if exists professional_payout_profiles_payout_method_check;
alter table public.professional_payout_profiles
  add constraint professional_payout_profiles_payout_method_check
  check (payout_method is null or payout_method in ('bank', 'raast', 'easypaisa', 'jazzcash'));
alter table public.professional_payout_profiles
  add column if not exists account_reference_masked text;

revoke select on public.professional_payout_profiles from authenticated;
grant select (
  professional_profile_id, payout_method, account_title, account_reference_masked,
  is_verified, created_at, updated_at
) on public.professional_payout_profiles to authenticated;

create or replace function public.create_fee_rule(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_payload jsonb
)
returns public.fee_rules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_rule public.fee_rules;
begin
  if p_actor_role <> 'super_admin' then raise exception using errcode = '42501', message = 'SUPER_ADMIN_REQUIRED'; end if;
  insert into public.fee_rules (
    name, scope, service_category_id, city_id, currency_code, fee_type,
    percentage_basis_points, fixed_amount_minor, minimum_fee_minor, maximum_fee_minor,
    effective_from, effective_until, is_active, created_by
  ) values (
    trim(p_payload->>'name'), 'platform_commission',
    nullif(p_payload->>'service_category_id', '')::uuid,
    nullif(p_payload->>'city_id', '')::uuid,
    'PKR', p_payload->>'fee_type',
    coalesce((p_payload->>'percentage_basis_points')::integer, 0),
    coalesce((p_payload->>'fixed_amount_minor')::bigint, 0),
    nullif(p_payload->>'minimum_fee_minor', '')::bigint,
    nullif(p_payload->>'maximum_fee_minor', '')::bigint,
    (p_payload->>'effective_from')::timestamptz,
    nullif(p_payload->>'effective_until', '')::timestamptz,
    coalesce((p_payload->>'is_active')::boolean, true),
    p_actor_profile_id
  ) returning * into v_rule;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'fee_rule.created', 'fee_rule', v_rule.id,
    jsonb_build_object('name', v_rule.name, 'fee_type', v_rule.fee_type, 'effective_from', v_rule.effective_from));
  return v_rule;
end;
$$;

create or replace function public.set_fee_rule_active(
  p_actor_profile_id uuid,
  p_actor_role text,
  p_fee_rule_id uuid,
  p_is_active boolean,
  p_reason text
)
returns public.fee_rules
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_rule public.fee_rules;
begin
  if p_actor_role <> 'super_admin' then raise exception using errcode = '42501', message = 'SUPER_ADMIN_REQUIRED'; end if;
  if char_length(trim(p_reason)) < 5 then raise exception using errcode = '22023', message = 'FEE_RULE_REASON_REQUIRED'; end if;
  update public.fee_rules set is_active = p_is_active
  where id = p_fee_rule_id returning * into v_rule;
  if not found then raise exception using errcode = 'P0002', message = 'FEE_RULE_NOT_FOUND'; end if;
  insert into public.audit_logs (actor_user_profile_id, action, entity_type, entity_id, after_data)
  values (p_actor_profile_id, 'fee_rule.status_changed', 'fee_rule', v_rule.id,
    jsonb_build_object('is_active', p_is_active, 'reason', trim(p_reason)));
  return v_rule;
end;
$$;

revoke all on function public.create_fee_rule(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.set_fee_rule_active(uuid, text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.create_fee_rule(uuid, text, jsonb) to service_role;
grant execute on function public.set_fee_rule_active(uuid, text, uuid, boolean, text) to service_role;

comment on column public.professional_payout_profiles.account_reference_encrypted is
  'Application-encrypted payout reference. Not selectable by authenticated clients.';
comment on column public.professional_payout_profiles.account_reference_masked is
  'Non-sensitive display suffix for professional and staff payout screens.';
