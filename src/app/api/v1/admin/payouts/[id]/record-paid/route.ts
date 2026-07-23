import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { payoutPaidSchema } from "@/lib/marketplace/payments/schemas";
import { recordPayoutPaid } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to record a payout.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const parsed = payoutPaidSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_PAYOUT_SETTLEMENT",
      "Add the transfer reference and evidence path.",
    );
  const { data, error } = await recordPayoutPaid(
    auth.context,
    (await params).id,
    parsed.data.providerReference,
    parsed.data.evidenceStoragePath,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payout: data });
}
