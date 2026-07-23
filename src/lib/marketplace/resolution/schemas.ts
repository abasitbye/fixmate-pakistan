import { z } from "zod";

export const reviewSchema = z.object({
  ratingOverall: z.number().int().min(1).max(5),
  ratingQuality: z.number().int().min(1).max(5).optional(),
  ratingTimeliness: z.number().int().min(1).max(5).optional(),
  ratingCommunication: z.number().int().min(1).max(5).optional(),
  ratingValue: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().min(3).max(3000).optional(),
});
export const moderationSchema = z.object({
  status: z.enum(["published", "hidden", "under_review", "removed"]),
  reason: z.string().trim().max(1000).default(""),
});
export const claimSchema = z.object({
  description: z.string().trim().min(10).max(4000),
});
export const claimResponseSchema = z.object({
  response: z.string().trim().min(5).max(4000),
});
export const revisitSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});
export const claimResolutionSchema = z.object({
  resolved: z.boolean(),
  resolution: z.string().trim().min(5).max(4000),
});
export const disputeSchema = z.object({
  reasonCategory: z.enum([
    "professional_no_show",
    "customer_no_show",
    "incomplete_work",
    "poor_workmanship",
    "property_damage",
    "unauthorized_work",
    "unapproved_material_charge",
    "payment_disagreement",
    "refund_disagreement",
    "harassment_misconduct",
    "safety_concern",
    "warranty_failure",
    "other",
  ]),
  description: z.string().trim().min(10).max(5000),
  requestedResolution: z.string().trim().min(3).max(2000),
  contactPreference: z.enum(["in_app", "email", "phone"]).default("in_app"),
});
export const disputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  visibility: z
    .enum(["shared", "customer_only", "professional_only", "internal_staff"])
    .default("shared"),
});
export const disputeWorkflowSchema = z.object({
  action: z.enum([
    "assign",
    "request_customer",
    "request_professional",
    "propose",
  ]),
  value: z.string().trim().min(1).max(5000),
});
export const disputeResolutionSchema = z.object({
  decisionType: z.enum([
    "no_action",
    "rework",
    "reschedule",
    "partial_refund",
    "full_refund",
    "partial_professional_payment",
    "full_professional_payment",
    "platform_fee_waiver",
    "account_warning",
    "suspension",
    "permanent_restriction",
    "external_referral",
  ]),
  customerRefundMinor: z.number().int().min(0).default(0),
  professionalReleaseMinor: z.number().int().min(0).default(0),
  platformFeeAdjustmentMinor: z.number().int().default(0),
  accountTargetId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(10).max(5000),
});
export const evidencePrepareSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "application/pdf",
  ]),
  fileSize: z.number().int().positive().max(26_214_400),
});
export const evidenceFinalizeSchema = evidencePrepareSchema.extend({
  path: z.string().min(3).max(500),
  description: z.string().trim().min(3).max(2000),
  visibility: z
    .enum(["shared", "customer_only", "professional_only", "internal_staff"])
    .default("shared"),
});
