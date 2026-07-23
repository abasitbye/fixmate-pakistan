import type { AppLocale } from "@/i18n/routing";

export function localizedPath(locale: AppLocale, path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? normalized : `/${locale}${normalized}`;
}
