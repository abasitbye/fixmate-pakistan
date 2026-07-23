import { apiError, apiSuccess } from "@/lib/api/response";
import { paymentCommandError } from "@/lib/marketplace/payments/api";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { approvePayout } from "@/lib/marketplace/payments/service";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to approve a payout.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const { data, error } = await approvePayout(auth.context, (await params).id);
  if (error || !data) return paymentCommandError(error);
  return apiSuccess({ payout: data });
}
