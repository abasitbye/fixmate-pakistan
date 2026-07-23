import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
import { revisitSchema } from "@/lib/marketplace/resolution/schemas";
import { scheduleRevisit } from "@/lib/marketplace/resolution/service";
import { resolutionCommandError } from "@/lib/marketplace/resolution/api";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const p = revisitSchema.safeParse(await r.json().catch(() => null));
  if (!p.success)
    return apiError(400, "INVALID_REVISIT", "Choose a future revisit time.");
  const { data, error } = await scheduleRevisit(
    a.context,
    (await params).id,
    p.data.scheduledAt,
  );
  return error || !data
    ? resolutionCommandError(error)
    : apiSuccess({ claim: data });
}
