import type { NextRequest } from "next/server";

import { getClientIp } from "@/lib/api/request";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/auth/rate-limit";
import { ensureEditableApplication } from "@/lib/professional/access";
import { professionalSubmitSchema } from "@/lib/professional/schemas";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

export async function POST(request:NextRequest){
  const context=await getAuthenticatedContext();if(!context)return apiError(401,"UNAUTHENTICATED","Sign in to submit your application.");
  const application=await ensureEditableApplication(context);if(!application)return apiError(409,"APPLICATION_NOT_EDITABLE","This application cannot be submitted from its current status.");
  const parsed=professionalSubmitSchema.safeParse(await request.json().catch(()=>null));if(!parsed.success)return apiError(400,"DECLARATION_REQUIRED","Accept the declaration and complete the security check.");
  const verified=await verifyTurnstileToken(parsed.data.turnstileToken,getClientIp(request));if(!verified.success)return apiError(400,"SECURITY_CHECK_FAILED","Complete the security check again.");
  const allowed=await consumeRateLimit({scope:"professional_submit",identifier:context.profile.id,limit:3,windowSeconds:3600});if(!allowed)return apiError(429,"TOO_MANY_REQUESTS","Please wait before submitting again.");
  const missing:string[]=[];
  if(!application.cnic_last4||!application.bio||application.years_experience===null||!application.primary_city_id||!application.travel_radius_km||application.has_tools===null||application.has_transport===null)missing.push("personal information");
  const [services,areas,schedules,references,documents,payout]=await Promise.all([
    context.supabase.from("professional_services").select("service_subcategory_id",{count:"exact",head:true}).eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_service_areas").select("service_zone_id",{count:"exact",head:true}).eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_availability_schedules").select("id",{count:"exact",head:true}).eq("professional_profile_id",context.profile.id).eq("is_active",true),
    context.supabase.from("professional_references").select("id",{count:"exact",head:true}).eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_documents").select("verification_types!inner(code,is_required)").eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_payout_profiles").select("professional_profile_id",{count:"exact",head:true}).eq("professional_profile_id",context.profile.id),
  ]);
  if(!services.count)missing.push("services");if(!areas.count)missing.push("service areas");if(!schedules.count)missing.push("availability");if((references.count??0)<2)missing.push("two references");if(!payout.count)missing.push("payment information");
  const requiredCodes=new Set(["cnic_front","cnic_back","identity_selfie","address_proof"]);for(const document of documents.data??[]){const type=document.verification_types as unknown as {code:string};requiredCodes.delete(type.code);}if(requiredCodes.size)missing.push("required documents");
  if(missing.length)return apiError(400,"APPLICATION_INCOMPLETE",`Complete: ${missing.join(", ")}.`);
  const {data:consentType}=await context.supabase.from("consent_types").select("id,current_version").eq("code","professional_declaration").single();if(!consentType)return apiError(500,"CONSENT_UNAVAILABLE","The professional declaration could not be recorded.");
  const {error:consentError}=await context.supabase.from("user_consents").upsert({user_profile_id:context.profile.id,consent_type_id:consentType.id,version:consentType.current_version,accepted:true},{onConflict:"user_profile_id,consent_type_id,version"});if(consentError)return apiError(500,"CONSENT_SAVE_FAILED","The declaration could not be recorded.");
  const {error}=await context.supabase.rpc("transition_professional_application",{target_professional_id:context.profile.id,target_status:"submitted",decision_notes:null});if(error)return apiError(409,"SUBMISSION_FAILED","Your application could not be submitted from its current status.");
  return apiSuccess({status:"submitted"});
}
