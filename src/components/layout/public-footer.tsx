import { Mail, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/brand/brand-mark";
import { Link } from "@/i18n/navigation";

export async function PublicFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-intro">
          <BrandMark />
          <p>{t("promise")}</p>
          <span><MapPin size={16} /> {t("launchArea")}</span>
        </div>
        <div>
          <h2>{t("platform")}</h2>
          <Link href="/how-it-works">{t("howItWorks")}</Link>
          <Link href="/services">{t("services")}</Link>
          <Link href="/safety">{t("safety")}</Link>
          <Link href="/service-areas">{t("serviceAreas")}</Link>
        </div>
        <div>
          <h2>{t("company")}</h2>
          <Link href="/about">{t("about")}</Link>
          <Link href="/become-a-professional">{t("professionals")}</Link>
          <Link href="/faq">{t("faq")}</Link>
          <Link href="/contact">{t("contact")}</Link>
        </div>
        <div>
          <h2>{t("legal")}</h2>
          <Link href="/privacy">{t("privacy")}</Link>
          <Link href="/terms">{t("terms")}</Link>
          <Link href="/professional-code">{t("code")}</Link>
          <a href="mailto:support@fixmate.pk"><Mail size={15} /> support@fixmate.pk</a>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} FixMate Pakistan.</span>
        <span>{t("tagline")}</span>
      </div>
    </footer>
  );
}

