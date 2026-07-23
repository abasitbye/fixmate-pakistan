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
      (select count(*)::int from storage.buckets where id in ('profile-images','professional-documents','verification-selfies','service-request-media')) as buckets,
      (select count(*)::int from pg_policies where schemaname = 'public') as policies
  `;

  if (counts.roles !== 5 || counts.categories !== 6 || counts.subcategories !== 48 || counts.cities < 2 || counts.buckets !== 4 || counts.policies < 40) {
    throw new Error("Seed or policy verification failed.");
  }

  console.log(`verified tables=${tables.length} rls=${tables.length} policies=${counts.policies}`);
  console.log(`verified roles=${counts.roles} categories=${counts.categories} subcategories=${counts.subcategories} cities=${counts.cities} private_buckets=${counts.buckets}`);
} finally {
  await sql.end({ timeout: 5 });
}
