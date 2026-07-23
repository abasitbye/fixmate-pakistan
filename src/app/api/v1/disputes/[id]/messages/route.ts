import { apiError, apiSuccess } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { disputeMessageSchema } from "@/lib/marketplace/resolution/schemas";
import { sendDisputeMessage } from "@/lib/marketplace/resolution/service";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = disputeMessageSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_MESSAGE", "Enter a valid message.");
  const id = (await params).id;
  if (
    !(await consumeRateLimit({
      scope: "dispute_message",
      identifier: `${a.context.profile.id}:${id}`,
      limit: 30,
      windowSeconds: 300,
    }))
  )
    return apiError(
      429,
      "RATE_LIMITED",
      "Please wait before sending more messages.",
    );
  const { data, error } = await sendDisputeMessage(
    a.context,
    id,
    p.data.body,
    p.data.visibility,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ message: data }, { status: 201 });
}
