import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const marketplaceFlagKeys = [
  "phase2.marketplace_enabled",
  "phase2.requests_enabled",
  "phase2.matching_enabled",
  "phase2.jobs_enabled",
  "phase2.payments_enabled",
  "phase2.resolution_enabled",
] as const;

export type MarketplaceFlag = (typeof marketplaceFlagKeys)[number];

export async function getMarketplaceFlags() {
  const { data, error } = await createAdminClient()
    .from("system_settings")
    .select("key,value")
    .in("key", [...marketplaceFlagKeys]);

  if (error) throw new Error("Marketplace feature flags could not be loaded.");

  return Object.fromEntries(
    marketplaceFlagKeys.map((key) => [
      key,
      data?.find((setting) => setting.key === key)?.value === true,
    ]),
  ) as Record<MarketplaceFlag, boolean>;
}

export async function isMarketplaceFeatureEnabled(flag: MarketplaceFlag) {
  const flags = await getMarketplaceFlags();
  return flags["phase2.marketplace_enabled"] && flags[flag];
}
