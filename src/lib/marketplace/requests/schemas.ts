import { z } from "zod";

export const requestDraftSchema = z
  .object({
    propertyId: z.uuid(),
    serviceCategoryId: z.uuid(),
    serviceSubcategoryId: z.uuid(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(4000),
    urgency: z.enum(["standard", "same_day", "emergency"]).default("standard"),
    pricingPreference: z
      .enum(["fixed_price", "estimated_range", "inspection_required", "professional_recommendation"])
      .default("professional_recommendation"),
    preferredDate: z.iso.date().optional().or(z.literal("")),
    preferredStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    preferredEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
    flexibilityMinutes: z.coerce.number().int().min(0).max(1440).default(60),
  })
  .superRefine((value, context) => {
    if (
      value.preferredStartTime &&
      value.preferredEndTime &&
      value.preferredStartTime >= value.preferredEndTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["preferredEndTime"],
        message: "End time must be later than start time.",
      });
    }
  });

export const requestUpdateSchema = requestDraftSchema.and(
  z.object({ version: z.number().int().positive() }),
);

export const requestSubmitSchema = z.object({
  version: z.number().int().positive(),
  turnstileToken: z.string().min(1),
});

export const requestCancelSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
});

export const requestMediaPrepareSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]),
  sizeBytes: z.number().int().positive().max(26_214_400),
});

export const requestMediaFinalizeSchema = requestMediaPrepareSchema.extend({
  storagePath: z.string().min(10).max(500),
  mediaType: z.enum(["image", "video"]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().int().min(1).max(60).optional(),
  caption: z.string().trim().max(300).optional(),
});

export type RequestDraftInput = z.infer<typeof requestDraftSchema>;
