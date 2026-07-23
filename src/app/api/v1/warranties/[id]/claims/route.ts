import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { claimSchema } from "@/lib/marketplace/resolution/schemas";
import { createClaim } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = claimSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_CLAIM", "Describe the warranty problem.");
  const { data, error } = await createClaim(
    a.context,
    (await params).id,
    p.data.description,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ claim: data }, { status: 201 });
}
