import { z } from "zod";

export const jobEnRouteSchema = z.object({
  version: z.number().int().positive(),
});

export const arrivalCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the six-digit arrival code."),
});

export const locationConsentSchema = z.object({
  consent: z.literal(true),
});

export const locationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(10_000).optional(),
});
