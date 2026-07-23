import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock3,
  Drill,
  Hammer,
  House,
  Microwave,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Link } from "@/i18n/navigation";

const services = [
  { key: "plumbing", icon: Wrench },
  { key: "electrical", icon: Zap },
  { key: "ac", icon: Snowflake },
  { key: "appliances", icon: Microwave },
  { key: "carpentry", icon: Hammer },
  { key: "handyman", icon: Drill },
] as const;

const steps = [
  { key: "request", number: "01" },
  { key: "compare", number: "02" },
  { key: "complete", number: "03" },
] as const;

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <>
      <PublicHeader />
      <main id="main-content">
        <section className="hero-section">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow__dot" />
                {t("launchEyebrow")}
              </div>
              <h1>{t("title")}</h1>
              <p className="hero-lead">{t("lead")}</p>
              <div className="hero-actions">
                <Link className="button button--primary button--large" href="/auth/sign-in">
                  {t("findProfessional")} <ArrowRight size={18} />
                </Link>
                <Link className="button button--light button--large" href="/become-a-professional">
                  {t("joinProfessional")}
                </Link>
              </div>
              <div className="hero-trust" aria-label={t("trustLabel")}>
                <span><BadgeCheck size={18} /> {t("verified")}</span>
                <span><ShieldCheck size={18} /> {t("protected")}</span>
                <span><Clock3 size={18} /> {t("supported")}</span>
              </div>
            </div>
            <div className="hero-visual" aria-label={t("brandVisualLabel")}>
              <div className="hero-logo-card">
                <Image
                  src="/brand/fixmate-logo.png"
                  alt="FixMate Pakistan"
                  width={1254}
                  height={1254}
                  priority
                  sizes="(max-width: 860px) 80vw, 440px"
                />
              </div>
              <div className="hero-proof-card hero-proof-card--top">
                <ShieldCheck size={23} />
                <span><strong>{t("proofVerified")}</strong>{t("proofIdentity")}</span>
              </div>
              <div className="hero-proof-card hero-proof-card--bottom">
                <Check size={23} />
                <span><strong>{t("proofApproved")}</strong>{t("proofBeforeWork")}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="promise-strip" aria-label={t("promiseLabel")}>
          <div className="container promise-strip__inner">
            <Sparkles size={20} />
            <p>{t("promise")}</p>
          </div>
        </section>

        <section className="section services-section">
          <div className="container">
            <div className="section-heading section-heading--split">
              <div>
                <span className="section-kicker">{t("servicesKicker")}</span>
                <h2>{t("servicesTitle")}</h2>
              </div>
              <p>{t("servicesLead")}</p>
            </div>
            <div className="service-grid">
              {services.map(({ key, icon: Icon }) => (
                <Link className="service-card" href="/services" key={key}>
                  <span className="service-card__icon"><Icon size={25} /></span>
                  <h3>{t(`services.${key}.title`)}</h3>
                  <p>{t(`services.${key}.description`)}</p>
                  <span className="service-card__link">
                    {t("exploreService")} <ArrowRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="section how-section">
          <div className="container">
            <div className="section-heading section-heading--center">
              <span className="section-kicker">{t("howKicker")}</span>
              <h2>{t("howTitle")}</h2>
              <p>{t("howLead")}</p>
            </div>
            <div className="steps-grid">
              {steps.map(({ key, number }) => (
                <article className="step-card" key={key}>
                  <span className="step-number">{number}</span>
                  <h3>{t(`steps.${key}.title`)}</h3>
                  <p>{t(`steps.${key}.description`)}</p>
                </article>
              ))}
            </div>
            <div className="journey-line" aria-label={t("journeyLabel")}>
              <span>{t("journeyRequest")}</span><i />
              <span>{t("journeyMatch")}</span><i />
              <span>{t("journeyApprove")}</span><i />
              <span>{t("journeyComplete")}</span>
            </div>
          </div>
        </section>

        <section className="section trust-section">
          <div className="container trust-grid">
            <div className="trust-visual">
              <div className="trust-house"><House size={84} strokeWidth={1.25} /></div>
              <div className="trust-shield"><ShieldCheck size={53} /></div>
            </div>
            <div className="trust-copy">
              <span className="section-kicker">{t("safetyKicker")}</span>
              <h2>{t("safetyTitle")}</h2>
              <p>{t("safetyLead")}</p>
              <ul className="check-list">
                {["identity", "price", "record", "support"].map((item) => (
                  <li key={item}><span><Check size={16} /></span>{t(`safety.${item}`)}</li>
                ))}
              </ul>
              <Link className="text-link" href="/safety">
                {t("learnSafety")} <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </section>

        <section className="section professional-section">
          <div className="container professional-card">
            <div>
              <span className="section-kicker section-kicker--light">{t("professionalKicker")}</span>
              <h2>{t("professionalTitle")}</h2>
              <p>{t("professionalLead")}</p>
            </div>
            <Link className="button button--light button--large" href="/become-a-professional">
              {t("professionalCta")} <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}

