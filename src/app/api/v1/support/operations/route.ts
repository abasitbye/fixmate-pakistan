import { apiError, apiSuccess } from "@/lib/api/response";
import { getStaffContext } from "@/lib/admin/access";
import { getMarketplaceOperationsSnapshot } from "@/lib/operations/service";

export async function GET() {
  if (!(await getStaffContext())) {
    return apiError(403, "FORBIDDEN", "Staff access required.");
  }

  try {
    return apiSuccess({
      operations: await getMarketplaceOperationsSnapshot(),
    });
  } catch {
    return apiError(
      500,
      "OPERATIONS_LOAD_FAILED",
      "Operational status could not be loaded.",
    );
  }
}
