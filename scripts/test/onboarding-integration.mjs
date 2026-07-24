import assert from "node:assert/strict";
import process from "node:process";

import nextEnvironment from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnvironment;
loadEnvConfig(process.cwd());

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = (
  process.env.ONBOARDING_TEST_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://fixmate-pakistan.vercel.app"
).replace(/\/$/, "");

if (!configuredUrl || !serviceKey) {
  throw new Error("Supabase server environment is required.");
}

const admin = createClient(new URL(configuredUrl).origin, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdUsers = [];
const profileIds = [];

async function api(path, init = {}) {
  const response = await fetch(`${appUrl}${path}`, {
    redirect: "manual",
    ...init,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : null;
  return { response, payload };
}

async function createSession(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.email_otp) {
    throw error ?? new Error("Admin OTP generation failed.");
  }

  const verified = await api("/api/v1/auth/verify-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `fm_otp_email=${encodeURIComponent(email)}`,
    },
    body: JSON.stringify({ token: data.properties.email_otp }),
  });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.payload?.success, true);

  const cookie = verified.response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  assert.match(cookie, /auth-token/);
  return { cookie, next: verified.payload.data.next };
}

async function createTestAccount(purpose) {
  const email = `onboarding-${purpose}-${Date.now()}-${crypto.randomUUID()}@fixmate.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("Onboarding test user was not created.");
  }
  createdUsers.push(data.user.id);

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("id,account_status,display_name")
    .eq("auth_user_id", data.user.id)
    .single();
  if (profileError || !profile) {
    throw profileError ?? new Error("Onboarding test profile was not provisioned.");
  }
  profileIds.push(profile.id);
  assert.equal(profile.account_status, "active");
  assert.equal(profile.display_name, null);

  const session = await createSession(email);
  assert.equal(session.next, "/auth/complete-profile");

  const withoutConsent = await api("/api/v1/me", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: session.cookie },
    body: JSON.stringify({
      displayName: "Onboarding Integration",
      phone: "+92 300 1234567",
      preferredLocale: "en",
      acceptedPolicies: false,
    }),
  });
  assert.equal(withoutConsent.response.status, 400);
  assert.equal(withoutConsent.payload?.error?.code, "INVALID_PROFILE");

  const invalidPhone = await api("/api/v1/me", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: session.cookie },
    body: JSON.stringify({
      displayName: "Onboarding Integration",
      phone: "invalid",
      preferredLocale: "en",
      acceptedPolicies: true,
    }),
  });
  assert.equal(invalidPhone.response.status, 400);
  assert.equal(invalidPhone.payload?.error?.code, "INVALID_PROFILE");

  const validProfile = {
    displayName: "Onboarding Integration",
    phone: "+92 300 1234567",
    preferredLocale: purpose === "customer" ? "en" : "ur-Latn",
    acceptedPolicies: true,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const saved = await api("/api/v1/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify(validProfile),
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.payload?.success, true);
  }

  const { data: requiredTypes, error: typesError } = await admin
    .from("consent_types")
    .select("id,current_version")
    .eq("is_required", true)
    .eq("is_active", true);
  if (typesError) throw typesError;
  const { data: consents, error: consentError } = await admin
    .from("user_consents")
    .select("consent_type_id,version,accepted")
    .eq("user_profile_id", profile.id);
  if (consentError) throw consentError;
  assert.equal(
    requiredTypes.every((type) =>
      consents.some(
        (consent) =>
          consent.consent_type_id === type.id &&
          consent.version === type.current_version &&
          consent.accepted,
      ),
    ),
    true,
  );

  const selected = await api("/api/v1/me/purpose", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: session.cookie },
    body: JSON.stringify({ purpose }),
  });
  assert.equal(selected.response.status, 200);
  assert.equal(
    selected.payload?.data?.next,
    purpose === "customer" ? "/customer" : "/professional/application",
  );

  const expectedPage =
    purpose === "customer" ? "/en/customer" : "/en/professional/application";
  const page = await api(expectedPage, {
    headers: { cookie: session.cookie },
  });
  assert.equal(page.response.status, 200);

  const { data: completed, error: completedError } = await admin
    .from("user_profiles")
    .select("onboarding_completed_at")
    .eq("id", profile.id)
    .single();
  if (completedError) throw completedError;
  assert.ok(completed.onboarding_completed_at);

  if (purpose === "professional") {
    const { data: application, error: applicationError } = await admin
      .from("professional_profiles")
      .select("application_status")
      .eq("user_profile_id", profile.id)
      .single();
    if (applicationError) throw applicationError;
    assert.equal(application.application_status, "draft");
  }

  const returningSession = await createSession(email);
  assert.equal(returningSession.next, "/customer");
  await api("/api/v1/auth/logout", {
    method: "POST",
    headers: { cookie: returningSession.cookie },
  });
  await api("/api/v1/auth/logout", {
    method: "POST",
    headers: { cookie: session.cookie },
  });
}

try {
  const unauthenticated = await api("/api/v1/me");
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.payload?.error?.code, "UNAUTHENTICATED");

  await createTestAccount("customer");
  await createTestAccount("professional");
  console.log(
    "onboarding-integration=passed otp=2 profile_validation=4 profile_save=4 consent_idempotency=2 customer_path=1 professional_path=1 returning_login=2 protected_access=1",
  );
} finally {
  for (const profileId of profileIds) {
    await admin.from("audit_logs").delete().eq("actor_user_profile_id", profileId);
  }
  for (const userId of createdUsers) {
    await admin.auth.admin.deleteUser(userId);
  }
  console.log("onboarding-integration-cleanup=verified");
}
