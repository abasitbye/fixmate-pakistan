import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { disputeWorkflowSchema } from "@/lib/marketplace/resolution/schemas";
import { updateDispute } from "@/lib/marketplace/resolution/service";
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
  const p = disputeWorkflowSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_WORKFLOW_ACTION", "Check the case action.");
  const { data, error } = await updateDispute(
    a.context,
    (await params).id,
    p.data.action,
    p.data.value,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ dispute: data });
}
