import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { ensureEditableApplication, getProfessionalApplication } from "@/lib/professional/access";
import { professionalProfileSchema } from "@/lib/professional/schemas";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401,"UNAUTHENTICATED","Sign in to view your application.");
  const application = await getProfessionalApplication(context);
  if (!application) return apiError(404,"APPLICATION_NOT_FOUND","Start a professional application first.");

  const [services,areas,schedules,documents,references,payout] = await Promise.all([
    context.supabase.from("professional_services").select("service_subcategory_id,years_experience,notes").eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_service_areas").select("service_zone_id").eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_availability_schedules").select("id,day_of_week,start_time,end_time,is_active").eq("professional_profile_id",context.profile.id).order("day_of_week"),
    context.supabase.from("professional_documents").select("id,verification_type_id,original_file_name,mime_type,size_bytes,review_status,review_notes,created_at,verification_types(code,name,is_required)").eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_references").select("id,full_name,relationship,phone,notes,verification_status").eq("professional_profile_id",context.profile.id),
    context.supabase.from("professional_payout_profiles").select("payout_method,account_title,is_verified").eq("professional_profile_id",context.profile.id).maybeSingle(),
  ]);
  return apiSuccess({ application, services:services.data??[], areas:areas.data??[], schedules:schedules.data??[], documents:documents.data??[], references:references.data??[], payout:payout.data??null });
}

export async function PATCH(request:Request) {
  const context=await getAuthenticatedContext();
  if(!context)return apiError(401,"UNAUTHENTICATED","Sign in to update your application.");
  if(!await ensureEditableApplication(context))return apiError(409,"APPLICATION_NOT_EDITABLE","This application can no longer be edited.");
  const parsed=professionalProfileSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return apiError(400,"INVALID_APPLICATION","Check the professional information.",parsed.error.flatten().fieldErrors);
  const {error}=await context.supabase.from("professional_profiles").update({business_name:parsed.data.businessName||null,cnic_last4:parsed.data.cnicLast4,years_experience:parsed.data.yearsExperience,bio:parsed.data.bio,primary_city_id:parsed.data.primaryCityId,travel_radius_km:parsed.data.travelRadiusKm,has_tools:parsed.data.hasTools,has_transport:parsed.data.hasTransport}).eq("user_profile_id",context.profile.id);
  if(error)return apiError(500,"APPLICATION_SAVE_FAILED","Your application could not be saved.");
  return apiSuccess({saved:true});
}
