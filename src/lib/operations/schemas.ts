import { z } from "zod";

export const operationalReviewSchema = z.object({
  status: z.enum(["acknowledged", "resolved"]),
  note: z.string().trim().min(5).max(2000),
});

export const riskReviewSchema = z.object({
  status: z.enum(["reviewing", "dismissed", "confirmed", "appealed", "closed"]),
  note: z.string().trim().min(10).max(2000),
});
