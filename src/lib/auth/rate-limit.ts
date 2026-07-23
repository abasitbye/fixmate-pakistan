import "server-only";

import { createHmac } from "node:crypto";

import { getServerEnvironment } from "@/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitInput = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
};

function hashIdentifier(identifier: string) {
  return createHmac("sha256", getServerEnvironment().DATA_ENCRYPTION_KEY)
    .update(identifier)
    .digest("hex");
}

export async function consumeRateLimit(input: RateLimitInput) {
  const admin = createAdminClient();
  const identifierHash = hashIdentifier(input.identifier);
  const windowStart = new Date(Date.now() - input.windowSeconds * 1_000).toISOString();

  const { count, error: countError } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("scope", input.scope)
    .eq("identifier_hash", identifierHash)
    .gte("occurred_at", windowStart);

  if (countError) throw countError;
  if ((count ?? 0) >= input.limit) return false;

  const { error: insertError } = await admin.from("rate_limit_events").insert({
    scope: input.scope,
    identifier_hash: identifierHash,
  });
  if (insertError) throw insertError;
  return true;
}
