import { z } from "zod";

export const inspectionCompleteSchema = z.object({
  inspectionId: z.uuid(),
  version: z.number().int().positive(),
  findings: z.string().trim().min(10).max(5000),
  recommendedWork: z.string().trim().min(10).max(5000),
  safetyNotes: z.string().trim().max(3000).optional().default(""),
});

export const quotationItemSchema = z.object({
  itemType: z.enum(["labor", "material", "other", "discount"]),
  description: z.string().trim().min(2).max(500),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(40),
  unitPriceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  materialSource: z.enum(["professional", "customer", "mixed"]).optional(),
});

export const quotationDraftSchema = z.object({
  quotationId: z.uuid().optional(),
  version: z.number().int().min(0).default(0),
  depositRequiredMinor: z.number().int().min(0).default(0),
  estimatedDurationMinutes: z.number().int().min(15).max(43_200),
  warrantyDays: z.number().int().min(0).max(3650),
  terms: z.string().trim().min(10).max(5000),
  exclusions: z.string().trim().max(3000).optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
  validUntil: z.iso.datetime({ offset: true }),
  items: z.array(quotationItemSchema).min(1).max(100),
});

export const quotationSubmitSchema = z.object({
  version: z.number().int().positive(),
});

export const quotationDecisionSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().max(2000).optional().default(""),
});

export const changeOrderDraftSchema = z.object({
  changeOrderId: z.uuid().optional(),
  version: z.number().int().min(0).default(0),
  reason: z.string().trim().min(3).max(1000),
  description: z.string().trim().min(3).max(4000),
  evidenceSummary: z.string().trim().max(2000).optional().default(""),
  laborChangeMinor: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  materialChangeMinor: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  otherChangeMinor: z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER),
  scheduleChangeMinutes: z.number().int().min(-43_200).max(43_200).default(0),
  emergencySafetyException: z.boolean().default(false),
  emergencyJustification: z.string().trim().max(2000).optional().default(""),
}).superRefine((value, context) => {
  if (value.laborChangeMinor + value.materialChangeMinor + value.otherChangeMinor === 0) {
    context.addIssue({ code: "custom", path: ["laborChangeMinor"], message: "A change order must change the approved total." });
  }
  if (value.emergencySafetyException && value.emergencyJustification.length < 10) {
    context.addIssue({ code: "custom", path: ["emergencyJustification"], message: "Document the emergency safety exception." });
  }
});

export const changeOrderSubmitSchema = z.object({ version: z.number().int().positive() });
export const changeOrderDecisionSchema = z.object({ reason: z.string().trim().max(2000).optional().default("") });
export const workVersionSchema = z.object({ version: z.number().int().positive() });
export const workPauseSchema = workVersionSchema.extend({ reason: z.string().trim().min(3).max(1000) });
export const completionSubmitSchema = workVersionSchema.extend({
  summary: z.string().trim().min(10).max(5000),
  outstandingNotes: z.string().trim().max(3000).optional().default(""),
});
export const completionDecisionSchema = z.object({
  notes: z.string().trim().max(3000).optional().default(""),
});
export const jobMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  replyToMessageId: z.uuid().optional(),
});
export const jobMediaPrepareSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(26_214_400),
});
export const jobMediaFinalizeSchema = jobMediaPrepareSchema.extend({
  storagePath: z.string().min(10).max(500),
  mediaStage: z.enum(["before_work", "inspection", "during_work", "material_receipt", "change_order_evidence", "after_work"]),
  mediaType: z.enum(["image", "video", "document"]),
  caption: z.string().trim().max(500).optional().default(""),
  takenAt: z.iso.datetime({ offset: true }).optional(),
});

export type QuotationDraftInput = z.infer<typeof quotationDraftSchema>;
export type ChangeOrderDraftInput = z.infer<typeof changeOrderDraftSchema>;
