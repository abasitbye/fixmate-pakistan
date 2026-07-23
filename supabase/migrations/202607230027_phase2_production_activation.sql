-- FixMate Pakistan Phase 2 production activation.
-- This migration is intentionally last: all capability, security, operations,
-- localization, test and runbook checkpoints are already present.

update public.consent_types
   set current_version = '2.0',
       updated_at = now()
 where code in ('terms_of_service', 'privacy_policy');

update public.system_settings
   set value = 'true'::jsonb,
       updated_at = now()
 where key in (
   'phase2.marketplace_enabled',
   'phase2.requests_enabled',
   'phase2.matching_enabled',
   'phase2.jobs_enabled',
   'phase2.payments_enabled',
   'phase2.resolution_enabled'
 );

insert into public.system_settings(key, value, is_public, description)
values (
  'phase2.release',
  jsonb_build_object(
    'status', 'active',
    'activatedAt', now(),
    'onlinePaymentProviderConfigured', false,
    'cashManualPaymentEnabled', true
  ),
  true,
  'Phase 2 production release state. Online payment remains provider-gated.'
)
on conflict (key) do update
set value = excluded.value,
    is_public = excluded.is_public,
    description = excluded.description,
    updated_at = now();

insert into public.audit_logs(action, entity_type, entity_id, after_data)
values (
  'phase2.production_activated',
  'platform_release',
  'phase2',
  jsonb_build_object(
    'capabilities', jsonb_build_array(
      'requests', 'matching', 'offers', 'bookings', 'jobs', 'payments',
      'reviews', 'warranties', 'disputes', 'operations'
    ),
    'onlinePaymentProviderConfigured', false
  )
);
