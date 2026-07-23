import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { propertySchema } from "@/lib/customer/schemas";

const propertySelection = "id,label,property_type,address_line_1,address_line_2,postal_code,access_notes,is_default,is_active,created_at,cities(id,name,provinces(name)),service_zones(id,name)";

export async function GET() {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view your properties.");

  const { data, error } = await context.supabase
    .from("properties")
    .select(propertySelection)
    .eq("customer_profile_id", context.profile.id)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) return apiError(500, "PROPERTIES_LOAD_FAILED", "Your properties could not be loaded.");
  return apiSuccess({ properties: data });
}

export async function POST(request: Request) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to add a property.");
  if (context.profile.account_status !== "active") return apiError(403, "ACCOUNT_RESTRICTED", "This account is restricted.");

  const parsed = propertySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_PROPERTY", "Check the property information.", parsed.error.flatten().fieldErrors);

  if (parsed.data.isDefault) {
    await context.supabase.from("properties").update({ is_default: false }).eq("customer_profile_id", context.profile.id);
  }

  const { data, error } = await context.supabase.from("properties").insert({
    customer_profile_id: context.profile.id,
    label: parsed.data.label,
    property_type: parsed.data.propertyType,
    address_line_1: parsed.data.addressLine1,
    address_line_2: parsed.data.addressLine2 || null,
    city_id: parsed.data.cityId,
    service_zone_id: parsed.data.serviceZoneId || null,
    postal_code: parsed.data.postalCode || null,
    access_notes: parsed.data.accessNotes || null,
    is_default: parsed.data.isDefault,
  }).select(propertySelection).single();

  if (error) return apiError(500, "PROPERTY_CREATE_FAILED", "Your property could not be saved.");
  return apiSuccess({ property: data }, { status: 201 });
}
