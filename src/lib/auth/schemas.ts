import { z } from "zod";

export const requestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  turnstileToken: z.string().min(1).max(4096),
});

export const verifyOtpSchema = z.object({
  token: z.string().regex(/^\d{6,8}$/),
});

export const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 -]{7,18}$/),
  preferredLocale: z.enum(["en", "ur", "ur-Latn"]),
  acceptedPolicies: z.literal(true),
});

export const accountPurposeSchema = z.object({
  purpose: z.enum(["customer", "professional"]),
});
