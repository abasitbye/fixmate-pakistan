import { randomUUID } from "node:crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { ensureEditableApplication } from "@/lib/professional/access";
import { documentUploadRequestSchema } from "@/lib/professional/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const extensions:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","application/pdf":"pdf"};
export async function POST(request:Request){
  const context=await getAuthenticatedContext();if(!context)return apiError(401,"UNAUTHENTICATED","Sign in to upload documents.");
  if(!await ensureEditableApplication(context))return apiError(409,"APPLICATION_NOT_EDITABLE","This application can no longer be edited.");
  const parsed=documentUploadRequestSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError(400,"INVALID_DOCUMENT","Check the document type and size.",parsed.error.flatten().fieldErrors);
  const admin=createAdminClient();const {data:type}=await admin.from("verification_types").select("id,code").eq("id",parsed.data.verificationTypeId).eq("is_active",true).single();if(!type)return apiError(400,"INVALID_DOCUMENT_TYPE","Choose a valid document type.");
  const storagePath=`${context.userId}/${type.code}/${randomUUID()}.${extensions[parsed.data.mimeType]}`;
  const {data,error}=await admin.storage.from(type.code==="identity_selfie"?"verification-selfies":"professional-documents").createSignedUploadUrl(storagePath);
  if(error||!data)return apiError(500,"UPLOAD_URL_FAILED","A secure upload could not be prepared.");
  return apiSuccess({storagePath,token:data.token,bucket:type.code==="identity_selfie"?"verification-selfies":"professional-documents"});
}
