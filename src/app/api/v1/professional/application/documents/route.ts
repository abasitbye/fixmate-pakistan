import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { ensureEditableApplication } from "@/lib/professional/access";
import { documentFinalizeSchema } from "@/lib/professional/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request:Request){
  const context=await getAuthenticatedContext();if(!context)return apiError(401,"UNAUTHENTICATED","Sign in to finalize documents.");
  if(!await ensureEditableApplication(context))return apiError(409,"APPLICATION_NOT_EDITABLE","This application can no longer be edited.");
  const parsed=documentFinalizeSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError(400,"INVALID_DOCUMENT","Check the document information.",parsed.error.flatten().fieldErrors);
  if(!parsed.data.storagePath.startsWith(`${context.userId}/`))return apiError(403,"INVALID_STORAGE_PATH","The uploaded document path is not owned by this account.");
  const {data:type}=await createAdminClient().from("verification_types").select("id,code").eq("id",parsed.data.verificationTypeId).eq("is_active",true).single();if(!type)return apiError(400,"INVALID_DOCUMENT_TYPE","Choose a valid document type.");
  if(!parsed.data.storagePath.includes(`/${type.code}/`))return apiError(400,"DOCUMENT_TYPE_MISMATCH","The uploaded document does not match its type.");
  const {data,error}=await context.supabase.from("professional_documents").insert({professional_profile_id:context.profile.id,verification_type_id:parsed.data.verificationTypeId,storage_path:parsed.data.storagePath,original_file_name:parsed.data.fileName,mime_type:parsed.data.mimeType,size_bytes:parsed.data.sizeBytes}).select("id,review_status").single();
  if(error)return apiError(500,"DOCUMENT_SAVE_FAILED","The document upload could not be recorded.");return apiSuccess({document:data},{status:201});
}
