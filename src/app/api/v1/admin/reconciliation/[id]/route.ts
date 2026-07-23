import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { reconciliationSchema } from "@/lib/marketplace/payments/schemas";
import { reconcilePayment } from "@/lib/marketplace/payments/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to reconcile a payment.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) =>
      ["support", "admin", "super_admin"].includes(role),
    )
  ) {
    return apiError(403, "FORBIDDEN", "Staff access is required.");
  }
  const parsed = reconciliationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return apiError(
      400,
      "INVALID_RECONCILIATION",
      "Document the reconciliation decision.",
    );
  const { data, error } = await reconcilePayment(
    auth.context,
    (await params).id,
    parsed.data.confirmed,
    parsed.data.resolution,
    parsed.data.evidenceReference,
  );
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ reconciliation: data });
}
