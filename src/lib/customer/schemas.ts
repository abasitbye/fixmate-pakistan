import { z } from "zod";

export const propertySchema = z.object({
  label: z.string().trim().min(2).max(60),
  propertyType: z.enum(["house", "apartment", "office", "shop", "other"]),
  addressLine1: z.string().trim().min(5).max(180),
  addressLine2: z.string().trim().max(180).optional().or(z.literal("")),
  cityId: z.uuid(),
  serviceZoneId: z.uuid().nullable().optional(),
  postalCode: z.string().trim().max(20).optional().or(z.literal("")),
  accessNotes: z.string().trim().max(500).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

export const updatePropertySchema = propertySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one property field is required.",
);
