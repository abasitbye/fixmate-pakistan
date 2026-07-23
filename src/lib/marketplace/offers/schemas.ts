import { z } from "zod";

export const offerItemSchema = z.object({
  itemType: z.enum(["labor", "material_estimate", "callout", "inspection", "other"]),
  description: z.string().trim().min(2).max(300),
  quantity: z.number().positive().max(10_000),
  unit: z.string().trim().min(1).max(30),
  unitPriceMinor: z.number().int().min(0).max(9_000_000_000_000),
});

export const offerDraftSchema = z.object({
  offerType: z.enum(["fixed_price", "estimated_range", "inspection_required"]),
  calloutFeeMinor: z.number().int().min(0),
  laborAmountMinor: z.number().int().min(0),
  materialEstimateMinor: z.number().int().min(0),
  minimumAmountMinor: z.number().int().min(0).nullable().optional(),
  maximumAmountMinor: z.number().int().min(0).nullable().optional(),
  inspectionFeeMinor: z.number().int().min(0),
  message: z.string().trim().min(10).max(2000),
  estimatedDurationMinutes: z.number().int().min(15).max(2880),
  proposedStartAt: z.iso.datetime(),
  proposedEndAt: z.iso.datetime(),
  includesMaterials: z.boolean(),
  warrantyDays: z.number().int().min(0).max(3650),
  validUntil: z.iso.datetime(),
  items: z.array(offerItemSchema).max(30),
}).superRefine((value, context) => {
  if (value.proposedStartAt >= value.proposedEndAt) {
    context.addIssue({ code: "custom", path: ["proposedEndAt"], message: "Offer end time must be later." });
  }
  if (value.validUntil <= new Date().toISOString()) {
    context.addIssue({ code: "custom", path: ["validUntil"], message: "Offer validity must be in the future." });
  }
  if (
    value.offerType === "estimated_range" &&
    (value.minimumAmountMinor == null ||
      value.maximumAmountMinor == null ||
      value.minimumAmountMinor > value.maximumAmountMinor)
  ) {
    context.addIssue({ code: "custom", path: ["maximumAmountMinor"], message: "Enter a valid estimated range." });
  }
});

export const offerSubmitSchema = z.object({
  version: z.number().int().positive(),
});

export const offerWithdrawSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
});

export const offerAcceptSchema = z.object({
  version: z.number().int().positive(),
  requestVersion: z.number().int().positive(),
});

export type OfferDraftInput = z.infer<typeof offerDraftSchema>;
