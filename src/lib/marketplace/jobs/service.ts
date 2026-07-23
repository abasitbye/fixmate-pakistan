import "server-only";

import type { AwaitedAuthenticatedContext } from "@/lib/professional/types";
import { createAdminClient } from "@/lib/supabase/admin";

const jobSelection =
  "id,job_reference,booking_id,request_id,customer_id,professional_id,property_id,service_category_id,service_subcategory_id,status,work_status,payment_status,warranty_status,dispute_status,scheduled_start_at,actual_en_route_at,actual_arrived_at,pause_reason,paused_at,completion_issue_status,version,created_at,bookings(booking_reference,scheduled_end_at,exact_address_released_at),service_requests(request_reference,title,description),service_categories(name_en),service_subcategories(name_en),professional_profiles!jobs_professional_id_fkey(business_name,user_profiles(display_name)),customer_profiles!jobs_customer_id_fkey(user_profiles(display_name))";

export function jobParticipantRole(
  context: AwaitedAuthenticatedContext,
  job: { customer_id: string; professional_id: string },
) {
  if (job.professional_id === context.profile.id) return "professional";
  if (job.customer_id === context.profile.id) return "customer";
  if (context.roles.includes("super_admin")) return "super_admin";
  if (context.roles.includes("admin")) return "admin";
  if (context.roles.includes("support")) return "support";
  return null;
}

export async function listJobs(context: AwaitedAuthenticatedContext) {
  return context.supabase
    .from("jobs")
    .select(jobSelection)
    .or(`customer_id.eq.${context.profile.id},professional_id.eq.${context.profile.id}`)
    .order("created_at", { ascending: false })
    .limit(50);
}

export async function getJob(context: AwaitedAuthenticatedContext, jobId: string) {
  const result = await context.supabase
    .from("jobs")
    .select(`${jobSelection},job_status_history(id,from_status,to_status,actor_role,reason,metadata,created_at),job_location_sessions(id,status,started_at,expires_at,ended_at,job_location_points(latitude,longitude,accuracy_meters,recorded_at))`)
    .eq("id", jobId)
    .single();
  if (result.error || !result.data) return { ...result, arrivalVerification: null };
  const role = jobParticipantRole(context, result.data);
  if (role !== "customer" && !["support", "admin", "super_admin"].includes(role ?? "")) {
    return { ...result, arrivalVerification: null };
  }
  const { data: verification } = await createAdminClient()
    .from("arrival_verifications")
    .select("id,job_id,expires_at,attempt_count,max_attempts,verified_at,status,created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { ...result, arrivalVerification: verification ?? null };
}

export async function markJobEnRoute(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  version: number,
) {
  return createAdminClient().rpc("mark_job_en_route", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_expected_version: version,
  });
}

export async function regenerateArrivalCode(
  context: AwaitedAuthenticatedContext,
  jobId: string,
) {
  return createAdminClient().rpc("regenerate_arrival_code", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
  });
}

export async function verifyArrivalCode(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  code: string,
) {
  return createAdminClient().rpc("verify_arrival_code", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_code: code,
  });
}

export async function startLocationSession(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  userAgent: string,
) {
  return createAdminClient().rpc("start_job_location_session", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_consent: true,
    p_ip_address: null,
    p_user_agent: userAgent,
  });
}

export async function recordLocationPoint(
  context: AwaitedAuthenticatedContext,
  jobId: string,
  latitude: number,
  longitude: number,
  accuracyMeters?: number,
) {
  return createAdminClient().rpc("record_job_location_point", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
    p_latitude: latitude,
    p_longitude: longitude,
    p_accuracy_meters: accuracyMeters ?? null,
  });
}

export async function stopLocationSession(
  context: AwaitedAuthenticatedContext,
  jobId: string,
) {
  return createAdminClient().rpc("stop_job_location_session", {
    p_actor_profile_id: context.profile.id,
    p_job_id: jobId,
  });
}
