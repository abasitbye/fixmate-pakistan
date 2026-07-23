import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { listDisputes } from "@/lib/marketplace/resolution/service";
export async function GET() {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  if (
    !a.context.roles.some((x) =>
      ["support", "admin", "super_admin"].includes(x),
    )
  )
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  const { data, error } = await listDisputes(a.context);
  return error
    ? apiError(500, "DISPUTES_LOAD_FAILED", "Disputes could not be loaded.")
    : apiSuccess({ disputes: data });
}
