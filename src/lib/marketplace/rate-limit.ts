import "server-only";

import { apiError } from "@/lib/api/response";
import { consumeRateLimit } from "@/lib/auth/rate-limit";

export async function enforceMarketplaceRateLimit(input: {
  profileId: string;
  scope: string;
  limit: number;
  windowSeconds: number;
}) {
  const allowed = await consumeRateLimit({
    identifier: input.profileId,
    scope: input.scope,
    limit: input.limit,
    windowSeconds: input.windowSeconds,
  });

  return allowed
    ? null
    : apiError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Please wait before trying again.",
      );
}
