import { Menu } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/brand/brand-mark";
import { Link } from "@/i18n/navigation";

import { LanguageSwitcher } from "./language-switcher";

export async function PublicHeader() {
  const t = await getTranslations("Navigation");

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <BrandMark />
        <nav className="desktop-nav" aria-label={t("primaryLabel")}>
          <Link href="/how-it-works">{t("howItWorks")}</Link>
          <Link href="/services">{t("services")}</Link>
          <Link href="/safety">{t("safety")}</Link>
          <Link href="/service-areas">{t("serviceAreas")}</Link>
        </nav>
        <div className="site-header__actions">
          <LanguageSwitcher />
          <Link className="button button--ghost header-sign-in" href="/auth/sign-in">
            {t("signIn")}
          </Link>
          <Link className="button button--primary header-join" href="/auth/sign-in">
            {t("getStarted")}
          </Link>
          <details className="mobile-menu">
            <summary aria-label={t("openMenu")}>
              <Menu size={22} />
            </summary>
            <nav aria-label={t("mobileLabel")}>
              <Link href="/how-it-works">{t("howItWorks")}</Link>
              <Link href="/services">{t("services")}</Link>
              <Link href="/safety">{t("safety")}</Link>
              <Link href="/service-areas">{t("serviceAreas")}</Link>
              <Link href="/become-a-professional">{t("becomeProfessional")}</Link>
              <Link href="/auth/sign-in">{t("signIn")}</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

