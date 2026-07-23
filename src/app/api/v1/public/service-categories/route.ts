import { apiError, apiSuccess } from "@/lib/api/response";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_categories").select("id,slug,name_en,name_ur,name_roman_ur,description_en,description_ur,description_roman_ur,icon_name,display_order,service_subcategories(id,slug,name_en,name_ur,name_roman_ur,display_order,is_active)").eq("is_active", true).order("display_order");
  if (error) return apiError(500, "CATEGORIES_LOAD_FAILED", "Service categories could not be loaded.");
  return apiSuccess({ categories: data.map((category) => ({ ...category, service_subcategories: category.service_subcategories?.filter((item) => item.is_active).sort((a, b) => a.display_order - b.display_order) ?? [] })) });
}
