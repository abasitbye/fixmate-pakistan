import { apiSuccess } from "@/lib/api/response";
import { getMarketplaceFlags } from "@/lib/marketplace/feature-flags";

export const dynamic = "force-dynamic";

export async function GET() {
  const flags = await getMarketplaceFlags();
  return apiSuccess({ flags });
}
