import { z } from "zod";

export const bookingConfirmSchema = z.object({
  version: z.number().int().positive(),
});

export const bookingRescheduleSchema = z.object({
  version: z.number().int().positive(),
  proposedStartAt: z.iso.datetime({ offset: true }),
  proposedEndAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(3).max(1000),
}).superRefine((value, context) => {
  if (new Date(value.proposedStartAt) >= new Date(value.proposedEndAt)) {
    context.addIssue({
      code: "custom",
      path: ["proposedEndAt"],
      message: "End time must be later than start time.",
    });
  }
  if (new Date(value.proposedStartAt) <= new Date()) {
    context.addIssue({
      code: "custom",
      path: ["proposedStartAt"],
      message: "Choose a future start time.",
    });
  }
});

export const bookingRescheduleResponseSchema = z.object({
  accept: z.boolean(),
});

export const bookingCancelSchema = z.object({
  version: z.number().int().positive(),
  reason: z.string().trim().min(3).max(1000),
  policyAcknowledged: z.boolean().default(false),
});

export const bookingNoShowSchema = z.object({
  party: z.enum(["customer", "professional", "mutual", "access_issue", "safety"]),
  reason: z.string().trim().min(10).max(2000),
  evidenceReference: z.string().trim().max(500).optional().default(""),
});

export type BookingRescheduleInput = z.infer<typeof bookingRescheduleSchema>;
export type BookingCancelInput = z.infer<typeof bookingCancelSchema>;
