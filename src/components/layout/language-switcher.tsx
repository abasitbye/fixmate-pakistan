"use client";

import { Languages } from "lucide-react";
import { useLocale } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const labels: Record<AppLocale, string> = {
  en: "English",
  ur: "اردو",
  "ur-Latn": "Roman Urdu",
};

export function LanguageSwitcher() {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="language-switcher">
      <Languages size={16} aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(event) => {
          const nextLocale = event.target.value as AppLocale;
          startTransition(() => router.replace(pathname, { locale: nextLocale }));
        }}
        aria-label="Language"
      >
        {Object.entries(labels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

