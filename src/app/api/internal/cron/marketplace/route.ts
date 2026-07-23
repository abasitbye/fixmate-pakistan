import { timingSafeEqual } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import {
  captureOperationalError,
  operationalReference,
} from "@/lib/observability/operations";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !supplied?.startsWith("Bearer ")) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(supplied);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export async function GET(request: Request) {
  const reference = operationalReference(request);
  if (!authorized(request)) {
    return apiError(401, "UNAUTHORIZED", "Cron authorization failed.");
  }

  try {
    const { data, error } = await createAdminClient().rpc(
      "run_marketplace_maintenance",
      { p_trigger_source: "vercel_cron" },
    );
    if (error || !data) throw error ?? new Error("Maintenance returned no data.");
    return apiSuccess(
      { reference, maintenance: data },
      { headers: { "x-request-id": reference } },
    );
  } catch (error) {
    captureOperationalError(error, "marketplace_maintenance", { reference });
    return apiError(
      500,
      "MAINTENANCE_FAILED",
      "Marketplace maintenance did not complete.",
    );
  }
}
