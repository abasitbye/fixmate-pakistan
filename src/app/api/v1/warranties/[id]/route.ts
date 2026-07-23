import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "@/lib/marketplace/resolution/route-utils";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const a = await getResolutionContext();
  if (!a.context) return a.response;
  const { data, error } = await a.context.supabase
    .from("job_warranties")
    .select("*,jobs(job_reference),warranty_claims(*)")
    .eq("id", (await params).id)
    .single();
  return error || !data
    ? apiError(404, "WARRANTY_NOT_FOUND", "The warranty was not found.")
    : apiSuccess({ warranty: data });
}
