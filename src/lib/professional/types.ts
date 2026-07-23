import type { getAuthenticatedContext } from "@/lib/auth/session";

export type AwaitedAuthenticatedContext = NonNullable<Awaited<ReturnType<typeof getAuthenticatedContext>>>;
