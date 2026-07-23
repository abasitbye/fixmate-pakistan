import process from "node:process";

import nextEnvironment from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) throw new Error("DATABASE_URL is required.");

function normalizeDatabaseUrl(value) {
  try {
    new URL(value);
    return value;
  } catch {
    const schemeEnd = value.indexOf("://");
    const authorityEnd = value.lastIndexOf("@");
    const passwordStart = value.indexOf(":", schemeEnd + 3);
    if (schemeEnd < 0 || authorityEnd < 0 || passwordStart < 0) return value;
    return `${value.slice(0, passwordStart + 1)}${encodeURIComponent(value.slice(passwordStart + 1, authorityEnd).trim())}${value.slice(authorityEnd)}`;
  }
}

const sql = postgres(normalizeDatabaseUrl(rawDatabaseUrl), {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  ssl: "require",
});

const expectedTables = [
  "audit_logs", "cities", "consent_types", "contact_messages", "countries", "customer_profiles",
  "notification_devices", "notification_preferences", "notifications", "professional_availability_overrides",
  "professional_availability_schedules", "professional_documents", "professional_payout_profiles",
  "professional_profiles", "professional_references", "professional_service_areas", "professional_services",
  "professional_verifications", "properties", "provinces", "rate_limit_events", "roles", "service_categories",
  "service_subcategories", "service_zones", "support_notes", "system_settings", "user_consents", "user_profiles",
  "user_roles", "verification_types",
  "accepted_offer_snapshots", "arrival_verifications", "booking_reschedule_requests", "bookings",
  "domain_outbox", "idempotency_keys", "job_status_history", "jobs", "matching_runs",
  "professional_offer_items", "professional_offers", "request_matching_candidates",
  "service_request_media", "service_request_status_history", "service_requests",
  "booking_status_history", "cancellation_policies", "job_location_sessions", "job_location_points",
  "job_inspections", "job_quotations", "job_quotation_items", "quotation_decisions",
  "job_media", "job_material_items", "job_change_orders", "job_messages",
  "job_message_attachments", "job_message_reads", "job_completions",
  "customer_payment_methods", "fee_rules", "payment_intents", "payment_transactions",
  "payment_webhook_events", "ledger_accounts", "ledger_entries", "professional_earnings",
  "professional_payouts", "payout_earning_items", "transaction_documents", "refunds",
  "payment_reconciliation_cases",
  "job_reviews", "professional_rating_aggregates", "job_warranties", "warranty_claims",
  "warranty_claim_evidence", "job_disputes", "dispute_evidence", "dispute_messages",
  "dispute_decisions", "dispute_status_history", "marketplace_account_actions",
];

try {
  const tables = await sql`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = any(${expectedTables})
  `;
  const missing = expectedTables.filter((name) => !tables.some((table) => table.name === name));
  const withoutRls = tables.filter((table) => !table.rls).map((table) => table.name);
  if (missing.length || withoutRls.length) {
    throw new Error(`Schema verification failed: missing=${missing.join(",") || "none"}; without_rls=${withoutRls.join(",") || "none"}`);
  }

  const [counts] = await sql`
    select
      (select count(*)::int from public.roles) as roles,
      (select count(*)::int from public.service_categories) as categories,
      (select count(*)::int from public.service_subcategories) as subcategories,
      (select count(*)::int from public.cities) as cities,
      (select count(*)::int from storage.buckets where id in ('profile-images','professional-documents','verification-selfies','service-request-media','job-evidence','financial-evidence','resolution-evidence')) as buckets,
      (select count(*)::int from public.system_settings where key like 'phase2.%' and value = 'false'::jsonb) as disabled_phase2_flags,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'create_service_request_draft','update_service_request_draft','submit_service_request','cancel_service_request'
      )) as request_commands,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'run_request_matching','save_professional_offer','submit_professional_offer',
        'withdraw_professional_offer','accept_professional_offer'
      )) as matching_commands,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'confirm_booking','request_booking_reschedule','respond_booking_reschedule',
        'preview_booking_cancellation','cancel_booking','record_booking_no_show',
        'mark_job_en_route','regenerate_arrival_code','verify_arrival_code',
        'start_job_location_session','record_job_location_point','stop_job_location_session',
        'purge_expired_job_location_data'
      )) as booking_commands,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'append_job_system_message','start_job_inspection','complete_job_inspection',
        'save_job_quotation','submit_job_quotation','decide_job_quotation',
        'save_job_change_order','submit_job_change_order','decide_job_change_order',
        'withdraw_job_change_order','send_job_message','mark_job_message_read',
        'start_job_work','pause_job_work','resume_job_work',
        'submit_job_completion','decide_job_completion'
      )) as execution_commands,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'calculate_marketplace_fee','ensure_ledger_account','create_job_payment_intent',
        'report_manual_payment','post_confirmed_manual_payment','confirm_manual_payment',
        'open_payment_disagreement','reconcile_manual_payment','request_payment_refund',
        'decide_payment_refund','complete_manual_refund','create_professional_payout',
        'approve_professional_payout','record_professional_payout_paid','record_payment_webhook_event',
        'create_fee_rule','set_fee_rule_active'
      )) as payment_commands,
      (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname in (
        'recalculate_professional_rating','submit_job_review','moderate_job_review',
        'create_warranty_claim','respond_warranty_claim','schedule_warranty_revisit',
        'resolve_warranty_claim','open_job_dispute','send_dispute_message',
        'add_resolution_evidence','update_dispute_workflow','resolve_job_dispute',
        'transition_resolved_dispute','escalate_warranty_claim'
      )) as resolution_commands,
      (select count(*)::int from pg_policies where schemaname = 'public') as policies
  `;

  if (counts.roles !== 5 || counts.categories !== 6 || counts.subcategories !== 48 || counts.cities < 2 || counts.buckets !== 7 || counts.disabled_phase2_flags !== 6 || counts.request_commands !== 4 || counts.matching_commands !== 5 || counts.booking_commands !== 13 || counts.execution_commands !== 17 || counts.payment_commands !== 17 || counts.resolution_commands !== 14 || counts.policies < 84) {
    throw new Error("Seed or policy verification failed.");
  }

  console.log(`verified tables=${tables.length} rls=${tables.length} policies=${counts.policies}`);
  console.log(`verified roles=${counts.roles} categories=${counts.categories} subcategories=${counts.subcategories} cities=${counts.cities} private_buckets=${counts.buckets}`);
  console.log(`verified phase2_flags_disabled=${counts.disabled_phase2_flags} request_commands=${counts.request_commands}`);
  console.log(`verified matching_offer_commands=${counts.matching_commands}`);
  console.log(`verified booking_arrival_commands=${counts.booking_commands}`);
  console.log(`verified job_execution_commands=${counts.execution_commands}`);
  console.log(`verified payment_accounting_commands=${counts.payment_commands}`);
  console.log(`verified resolution_commands=${counts.resolution_commands}`);
} finally {
  await sql.end({ timeout: 5 });
}
