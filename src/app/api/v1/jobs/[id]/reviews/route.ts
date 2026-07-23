import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { reviewSchema } from "@/lib/marketplace/resolution/schemas";
import {
  listJobReviews,
  submitReview,
} from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const { data, error } = await listJobReviews(a.context, (await params).id);
  return error
    ? apiError(500, "REVIEWS_LOAD_FAILED", "Reviews could not be loaded.")
    : apiSuccess({ reviews: data });
}
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = reviewSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_REVIEW", "Check the rating and comment.");
  const { data, error } = await submitReview(
    a.context,
    (await params).id,
    p.data,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ review: data }, { status: 201 });
}
