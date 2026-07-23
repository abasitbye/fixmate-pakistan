import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { getDispute } from "@/lib/marketplace/resolution/service";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const { data, error } = await getDispute(a.context, (await params).id);
  return error || !data
    ? apiError(404, "DISPUTE_NOT_FOUND", "The dispute was not found.")
    : apiSuccess({ dispute: data });
}
