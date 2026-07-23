import { z } from "zod";

const minorAmount = z.number().int().positive().max(9_000_000_000_000);

export const createPaymentIntentSchema = z.object({
  methodType: z.enum(["cash", "manual_bank_transfer"]),
  paymentMethodId: z.string().uuid().nullable().optional(),
});

export const manualPaymentReportSchema = z.object({
  note: z.string().trim().max(1000).default(""),
});

export const paymentDisagreementSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export const refundRequestSchema = z.object({
  amountMinor: minorAmount,
  reason: z.string().trim().min(5).max(2000),
});

export const refundDecisionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(5).max(2000),
});

export const refundCompletionSchema = z.object({
  providerReference: z.string().trim().min(3).max(300),
});

export const reconciliationSchema = z.object({
  confirmed: z.boolean(),
  resolution: z.string().trim().min(5).max(2000),
  evidenceReference: z.string().trim().max(500).default(""),
});

export const payoutCreateSchema = z.object({
  professionalId: z.string().uuid(),
  earningIds: z.array(z.string().uuid()).min(1).max(200),
});

export const payoutPaidSchema = z.object({
  providerReference: z.string().trim().min(3).max(300),
  evidenceStoragePath: z.string().trim().min(3).max(500),
});

export const feeRuleSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    serviceCategoryId: z.string().uuid().nullable().optional(),
    cityId: z.string().uuid().nullable().optional(),
    feeType: z.enum(["percentage", "fixed", "percentage_plus_fixed"]),
    percentageBasisPoints: z.number().int().min(0).max(10_000).default(0),
    fixedAmountMinor: z.number().int().min(0).max(9_000_000_000_000).default(0),
    minimumFeeMinor: z.number().int().min(0).nullable().optional(),
    maximumFeeMinor: z.number().int().min(0).nullable().optional(),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveUntil: z.string().datetime({ offset: true }).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine(
    (value) =>
      value.maximumFeeMinor == null ||
      value.minimumFeeMinor == null ||
      value.maximumFeeMinor >= value.minimumFeeMinor,
    {
      message: "Maximum fee must be greater than or equal to the minimum fee.",
      path: ["maximumFeeMinor"],
    },
  );
