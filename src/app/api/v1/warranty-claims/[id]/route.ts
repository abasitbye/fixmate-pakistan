import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { getClaim } from "@/lib/marketplace/resolution/service";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const { data, error } = await getClaim(a.context, (await params).id);
  return error || !data
    ? apiError(404, "CLAIM_NOT_FOUND", "The warranty claim was not found.")
    : apiSuccess({ claim: data });
}
