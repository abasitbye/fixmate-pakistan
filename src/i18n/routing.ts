import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ur", "ur-Latn"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeCookie: {
    name: "FIXMATE_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  },
});

export type AppLocale = (typeof routing.locales)[number];

