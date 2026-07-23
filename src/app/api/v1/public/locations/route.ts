import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("cities").select("id,name,provinces(name),service_zones(id,name,is_active)").eq("is_active", true).order("name");
  if (error) return apiError(500, "LOCATIONS_LOAD_FAILED", "Service locations could not be loaded.");
  return apiSuccess({ cities: data.map((city) => ({ ...city, service_zones: city.service_zones?.filter((zone) => zone.is_active) ?? [] })) });
}
