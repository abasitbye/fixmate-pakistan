import { apiError, apiSuccess } from "@/lib/api/response";
import { parseIdempotencyKey } from "@/lib/marketplace/idempotency";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { disputeSchema } from "@/lib/marketplace/resolution/schemas";
import { openDispute } from "@/lib/marketplace/resolution/service";
import { enforceMarketplaceRateLimit } from "@/lib/marketplace/rate-limit";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const limited = await enforceMarketplaceRateLimit({
    profileId: a.context.profile.id,
    scope: "marketplace.dispute.open",
    limit: 5,
    windowSeconds: 3600,
  });
  if (limited) return limited;
  const p = disputeSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(
      400,
      "INVALID_DISPUTE",
      "Add the dispute details and requested outcome.",
    );
  let key: string;
  try {
    key = parseIdempotencyKey(r);
  } catch {
    return apiError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid action key is required.",
    );
  }
  const { data, error } = await openDispute(
    a.context,
    (await params).id,
    p.data,
    key,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ dispute: data }, { status: 201 });
}
