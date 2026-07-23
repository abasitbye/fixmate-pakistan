import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { disputeResolutionSchema } from "@/lib/marketplace/resolution/schemas";
import { resolveDispute } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
import { enforceMarketplaceRateLimit } from "@/lib/marketplace/rate-limit";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  if (!a.context.roles.some((x) => ["admin", "super_admin"].includes(x)))
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const limited = await enforceMarketplaceRateLimit({
    profileId: a.context.profile.id,
    scope: "marketplace.admin.dispute-resolution",
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;
  const p = disputeResolutionSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(
      400,
      "INVALID_DISPUTE_DECISION",
      "Check the resolution amounts, action, and reason.",
    );
  const { data, error } = await resolveDispute(
    a.context,
    (await params).id,
    p.data,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ dispute: data });
}
