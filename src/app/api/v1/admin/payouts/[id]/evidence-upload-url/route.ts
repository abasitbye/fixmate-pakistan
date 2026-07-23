import { randomUUID } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getPaymentContext } from "@/lib/marketplace/payments/route-utils";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getPaymentContext("Sign in to upload payout evidence.");
  if (!auth.context) return auth.response;
  if (
    !auth.context.roles.some((role) => ["admin", "super_admin"].includes(role))
  )
    return apiError(403, "FORBIDDEN", "Administrator access is required.");
  const body = (await request.json().catch(() => null)) as {
    fileName?: string;
    mimeType?: string;
  } | null;
  const allowed = new Map([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["application/pdf", "pdf"],
  ]);
  const extension = body?.mimeType ? allowed.get(body.mimeType) : undefined;
  if (!extension)
    return apiError(
      400,
      "INVALID_EVIDENCE_FILE",
      "Use a JPG, PNG, WebP, or PDF file up to 10 MB.",
    );
  const payoutId = (await params).id;
  const path = `payouts/${payoutId}/${randomUUID()}.${extension}`;
  const { data, error } = await createAdminClient()
    .storage.from("financial-evidence")
    .createSignedUploadUrl(path);
  if (error || !data)
    return apiError(
      500,
      "UPLOAD_URL_FAILED",
      "The secure evidence upload could not be prepared.",
    );
  return apiSuccess({ path, token: data.token, signedUrl: data.signedUrl });
}
