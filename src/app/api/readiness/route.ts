import { NextResponse } from "next/server";

import { getEnvironmentReadiness } from "@/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = Object.values(getEnvironmentReadiness()).every(Boolean);
  const admin = createAdminClient();
  const [{ error: databaseError }, { count: deadLetters, error: queueError }] =
    await Promise.all([
      admin.from("system_settings").select("key").limit(1),
      admin
        .from("domain_outbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "dead_letter"),
    ]);

  const database = !databaseError;
  const queue = !queueError && (deadLetters ?? 0) === 0;
  const ready = environment && database && queue;

  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      service: "fixmate-pakistan-web",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp: new Date().toISOString(),
      checks: { environment, database, queue },
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
