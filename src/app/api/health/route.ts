import { NextResponse } from "next/server";

import { getEnvironmentReadiness } from "@/env/server";

export const dynamic = "force-dynamic";

export function GET() {
  const readiness = getEnvironmentReadiness();
  const configured = Object.values(readiness).every(Boolean);

  return NextResponse.json(
    {
      status: configured ? "ok" : "degraded",
      service: "fixmate-pakistan-web",
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      timestamp: new Date().toISOString(),
      checks: {
        application: true,
        environment: configured,
      },
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

