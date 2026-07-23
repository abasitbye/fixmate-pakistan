import { z } from "zod";

import { apiError, apiSuccess } from "@/lib/api/response";
import { getAuthenticatedContext } from "@/lib/auth/session";
import { updatePropertySchema } from "@/lib/customer/schemas";

const idSchema = z.uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to view this property.");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError(400, "INVALID_PROPERTY_ID", "The property identifier is invalid.");

  const { data, error } = await context.supabase.from("properties").select("*").eq("id", id).eq("customer_profile_id", context.profile.id).single();
  if (error || !data) return apiError(404, "PROPERTY_NOT_FOUND", "Property not found.");
  return apiSuccess({ property: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to update this property.");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError(400, "INVALID_PROPERTY_ID", "The property identifier is invalid.");
  const parsed = updatePropertySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "INVALID_PROPERTY", "Check the property information.", parsed.error.flatten().fieldErrors);

  if (parsed.data.isDefault) {
    await context.supabase.from("properties").update({ is_default: false }).eq("customer_profile_id", context.profile.id).neq("id", id);
  }

  const patch = {
    ...(parsed.data.label !== undefined && { label: parsed.data.label }),
    ...(parsed.data.propertyType !== undefined && { property_type: parsed.data.propertyType }),
    ...(parsed.data.addressLine1 !== undefined && { address_line_1: parsed.data.addressLine1 }),
    ...(parsed.data.addressLine2 !== undefined && { address_line_2: parsed.data.addressLine2 || null }),
    ...(parsed.data.cityId !== undefined && { city_id: parsed.data.cityId }),
    ...(parsed.data.serviceZoneId !== undefined && { service_zone_id: parsed.data.serviceZoneId || null }),
    ...(parsed.data.postalCode !== undefined && { postal_code: parsed.data.postalCode || null }),
    ...(parsed.data.accessNotes !== undefined && { access_notes: parsed.data.accessNotes || null }),
    ...(parsed.data.isDefault !== undefined && { is_default: parsed.data.isDefault }),
  };

  const { data, error } = await context.supabase.from("properties").update(patch).eq("id", id).eq("customer_profile_id", context.profile.id).select("*").single();
  if (error || !data) return apiError(404, "PROPERTY_NOT_FOUND", "Property not found or could not be updated.");
  return apiSuccess({ property: data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthenticatedContext();
  if (!context) return apiError(401, "UNAUTHENTICATED", "Sign in to remove this property.");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return apiError(400, "INVALID_PROPERTY_ID", "The property identifier is invalid.");

  const { data, error } = await context.supabase.from("properties").update({ is_active: false, is_default: false }).eq("id", id).eq("customer_profile_id", context.profile.id).select("id").single();
  if (error || !data) return apiError(404, "PROPERTY_NOT_FOUND", "Property not found.");
  return apiSuccess({ removed: true });
}
