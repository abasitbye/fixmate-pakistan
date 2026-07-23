import { apiError, apiSuccess } from "@/lib/api/response";
import { getStaffContext } from "@/lib/admin/access";
import { enforceMarketplaceRateLimit } from "@/lib/marketplace/rate-limit";
import { operationalReviewSchema } from "@/lib/operations/schemas";
import { reviewOperationalAlert } from "@/lib/operations/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getStaffContext();
  if (!context) return apiError(403, "FORBIDDEN", "Staff access required.");

  const limited = await enforceMarketplaceRateLimit({
    profileId: context.profile.id,
    scope: "marketplace.operations.alert-review",
    limit: 30,
    windowSeconds: 300,
  });
  if (limited) return limited;

  const parsed = operationalReviewSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return apiError(
      400,
      "INVALID_ALERT_REVIEW",
      "Choose a valid outcome and document the review.",
    );
  }

  const { data, error } = await reviewOperationalAlert(
    context.profile.id,
    (await params).id,
    parsed.data.status,
    parsed.data.note,
  );
  if (error || !data) {
    return apiError(
      409,
      "ALERT_REVIEW_FAILED",
      "The operational alert could not be updated.",
    );
  }
  return apiSuccess({ alert: data });
}
