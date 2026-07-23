import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
export async function GET() {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  if (
    !a.context.roles.some((x) =>
      ["support", "admin", "super_admin"].includes(x),
    )
  )
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  const { data, error } = await a.context.supabase
    .from("job_reviews")
    .select("*,jobs(job_reference)")
    .order("submitted_at", { ascending: false });
  return error
    ? apiError(500, "REVIEWS_LOAD_FAILED", "Reviews could not be loaded.")
    : apiSuccess({ reviews: data });
}
