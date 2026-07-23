import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { claimResponseSchema } from "@/lib/marketplace/resolution/schemas";
import { respondClaim } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = claimResponseSchema.safeParse(await r.json().catch(() => null));
  if (!p.success) return apiError(400, "INVALID_RESPONSE", "Add a response.");
  const { data, error } = await respondClaim(
    a.context,
    (await params).id,
    p.data.response,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ claim: data });
}
