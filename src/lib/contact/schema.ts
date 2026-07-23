import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(20).max(3000),
  turnstileToken: z.string().min(1).max(4096),
});
