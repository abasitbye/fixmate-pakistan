import { z } from "zod";

export const professionalProfileSchema = z.object({
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  cnicLast4: z.string().regex(/^\d{4}$/),
  yearsExperience: z.coerce.number().int().min(0).max(80),
  bio: z.string().trim().min(40).max(1200),
  primaryCityId: z.uuid(),
  travelRadiusKm: z.coerce.number().int().min(1).max(100),
  hasTools: z.boolean(),
  hasTransport: z.boolean(),
});

export const professionalServicesSchema = z.object({
  subcategoryIds: z.array(z.uuid()).min(1).max(30),
});

export const professionalAreasSchema = z.object({
  serviceZoneIds: z.array(z.uuid()).min(1).max(30),
});

const scheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean().default(true),
}).refine((item) => item.startTime < item.endTime, { message: "End time must be later than start time." });

export const professionalAvailabilitySchema = z.object({
  schedules: z.array(scheduleSchema).min(1).max(14),
});

export const professionalReferencesSchema = z.object({
  references: z.array(z.object({
    fullName: z.string().trim().min(2).max(100),
    relationship: z.string().trim().min(2).max(80),
    phone: z.string().trim().regex(/^\+?[0-9][0-9 -]{7,18}$/),
    notes: z.string().trim().max(300).optional().or(z.literal("")),
  })).min(2).max(4),
});

export const payoutProfileSchema = z.object({
  payoutMethod: z.enum(["bank", "easypaisa", "jazzcash"]),
  accountTitle: z.string().trim().min(2).max(120),
  accountReference: z.string().trim().min(5).max(80),
});

export const documentUploadRequestSchema = z.object({
  verificationTypeId: z.uuid(),
  fileName: z.string().trim().min(1).max(180).regex(/^[^\\/]+$/),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export const documentFinalizeSchema = documentUploadRequestSchema.extend({
  storagePath: z.string().min(1).max(500),
});

export const professionalSubmitSchema = z.object({
  declarationAccepted: z.literal(true),
  turnstileToken: z.string().min(1).max(4096),
});
