import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { moderationSchema } from "@/lib/marketplace/resolution/schemas";
import { moderateReview } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function PATCH(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  if (
    !a.context.roles.some((x) =>
      ["support", "admin", "super_admin"].includes(x),
    )
  )
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  const p = moderationSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_MODERATION", "Check the status and reason.");
  const { data, error } = await moderateReview(
    a.context,
    (await params).id,
    p.data.status,
    p.data.reason,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ review: data });
}
