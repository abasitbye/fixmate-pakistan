import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getResolutionContext } from "./route-utils";
import { evidenceFinalizeSchema, evidencePrepareSchema } from "./schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { primaryRole } from "../payments/service";
import { resolutionCommandError } from "./api";
import { enforceMarketplaceRateLimit } from "../rate-limit";
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "application/pdf": "pdf",
};
async function canAccess(
  caseType: "claim" | "dispute",
  context: NonNullable<
    Awaited<ReturnType<typeof getResolutionContext>>["context"]
  >,
  id: string,
) {
  return caseType === "claim"
    ? context.supabase
        .from("warranty_claims")
        .select("id")
        .eq("id", id)
        .maybeSingle()
    : context.supabase
        .from("job_disputes")
        .select("id")
        .eq("id", id)
        .maybeSingle();
}
export function evidenceUploadHandler(caseType: "claim" | "dispute") {
  return async function POST(
    r: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const a = await getResolutionContext();
    if (!a.context) return a.response;
    const limited = await enforceMarketplaceRateLimit({
      profileId: a.context.profile.id,
      scope: `marketplace.${caseType}.evidence-upload`,
      limit: 20,
      windowSeconds: 3600,
    });
    if (limited) return limited;
    const id = (await params).id;
    const access = await canAccess(caseType, a.context, id);
    if (!access.data)
      return apiError(404, "CASE_NOT_FOUND", "The case was not found.");
    const p = evidencePrepareSchema.safeParse(await r.json().catch(() => null));
    if (!p.success)
      return apiError(
        400,
        "INVALID_EVIDENCE",
        "Use a supported file up to 25 MB.",
      );
    const path = `${caseType}s/${id}/${randomUUID()}.${extensions[p.data.mimeType]}`;
    const { data, error } = await createAdminClient()
      .storage.from("resolution-evidence")
      .createSignedUploadUrl(path);
    return error || !data
      ? apiError(
          500,
          "UPLOAD_URL_FAILED",
          "Secure evidence upload could not be prepared.",
        )
      : apiSuccess({ path, token: data.token, signedUrl: data.signedUrl });
  };
}
export function evidenceFinalizeHandler(caseType: "claim" | "dispute") {
  return async function POST(
    r: Request,
    { params }: { params: Promise<{ id: string }> },
  ) {
    const a = await getResolutionContext();
    if (!a.context) return a.response;
    const limited = await enforceMarketplaceRateLimit({
      profileId: a.context.profile.id,
      scope: `marketplace.${caseType}.evidence-finalize`,
      limit: 40,
      windowSeconds: 3600,
    });
    if (limited) return limited;
    const p = evidenceFinalizeSchema.safeParse(
      await r.json().catch(() => null),
    );
    if (!p.success)
      return apiError(400, "INVALID_EVIDENCE", "Check the evidence metadata.");
    const id = (await params).id;
    if (!p.data.path.startsWith(`${caseType}s/${id}/`))
      return apiError(
        400,
        "INVALID_EVIDENCE_PATH",
        "The evidence path is invalid.",
      );
    const type = p.data.mimeType.startsWith("image/")
      ? "image"
      : p.data.mimeType.startsWith("video/")
        ? "video"
        : "document";
    const { data, error } = await createAdminClient().rpc(
      "add_resolution_evidence",
      {
        p_actor_profile_id: a.context.profile.id,
        p_actor_role: primaryRole(a.context.roles),
        p_case_type: caseType,
        p_case_id: id,
        p_evidence_type: type,
        p_storage_path: p.data.path,
        p_mime_type: p.data.mimeType,
        p_file_size: p.data.fileSize,
        p_description: p.data.description,
        p_visibility: p.data.visibility,
      },
    );
    return error || !data
      ? resolutionCommandError(error)
      : apiSuccess({ evidenceId: data }, { status: 201 });
  };
}
