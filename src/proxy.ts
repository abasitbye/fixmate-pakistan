import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/proxy";

const handleInternationalization = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const internationalizedResponse = handleInternationalization(request);
  return updateSession(request, internationalizedResponse);
}

// Next.js requires this object to remain statically analyzable. Keep the matcher
// synchronized with src/lib/routing/proxy-config.ts, which is used in unit tests.
export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|firebase-messaging-sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
