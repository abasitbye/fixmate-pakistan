import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { listWarranties } from "@/lib/marketplace/resolution/service";
export async function GET() {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const { data, error } = await listWarranties(a.context);
  return error
    ? apiError(500, "WARRANTIES_LOAD_FAILED", "Warranties could not be loaded.")
    : apiSuccess({ warranties: data });
}
