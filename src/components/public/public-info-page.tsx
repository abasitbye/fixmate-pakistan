import { ArrowRight, CheckCircle2 } from "lucide-react";

import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { getPublicPageCopy, type PublicPageKey } from "@/content/public-pages";

export function PublicInfoPage({ pageKey, locale }: { pageKey: PublicPageKey; locale: AppLocale }) {
  const copy = getPublicPageCopy(pageKey, locale);
  const isProfessional = pageKey === "professional";
  return <><PublicHeader /><main id="main-content"><section className="inner-hero"><div className="container"><span className="section-kicker section-kicker--light">{copy.kicker}</span><h1>{copy.title}</h1><p>{copy.lead}</p></div></section><section className="section"><div className="container info-grid">{copy.sections.map((section) => <article className="info-card" key={section.title}><span><CheckCircle2 size={22} /></span><h2>{section.title}</h2><p>{section.body}</p></article>)}</div><div className="container info-cta"><div><span className="section-kicker">FixMate Pakistan</span><h2>{isProfessional ? "Ready to start your application?" : "Ready to create your secure account?"}</h2></div><Link className="button button--primary button--large" href="/auth/sign-in">{isProfessional ? "Start application" : "Get started"}<ArrowRight size={18} /></Link></div></section></main><PublicFooter /></>;
}
