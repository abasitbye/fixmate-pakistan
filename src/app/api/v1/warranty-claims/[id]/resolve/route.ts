import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { claimResolutionSchema } from "@/lib/marketplace/resolution/schemas";
import { resolveClaim } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = claimResolutionSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_RESOLUTION", "Document the claim outcome.");
  const { data, error } = await resolveClaim(
    a.context,
    (await params).id,
    p.data.resolution,
    p.data.resolved,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ claim: data });
}
