import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { transitionDispute } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function POST(
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
  const b = (await r.json().catch(() => null)) as { reason?: string } | null;
  if (!b?.reason || b.reason.trim().length < 10)
    return apiError(
      400,
      "REOPEN_REASON_REQUIRED",
      "Document the appeal or reopening reason.",
    );
  const { data, error } = await transitionDispute(
    a.context,
    (await params).id,
    "reopen",
    b.reason,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ dispute: data });
}
