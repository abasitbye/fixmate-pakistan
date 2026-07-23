import { ArrowLeft, MapPinHouse, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { OfferForm } from "@/components/professional/offer-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getProfessionalInvitation } from "@/lib/marketplace/matching/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalRequestPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) redirect(localizedPath(locale, "/professional"));
  const { data: invitation } = await getProfessionalInvitation(context, id);
  if (!invitation) notFound();
  const request = invitation.service_requests as unknown as {
    id: string; request_reference: string; title: string; description: string; urgency: string;
    pricing_preference: string; preferred_date: string; preferred_start_time: string; preferred_end_time: string;
    service_zones?: { name?: string; cities?: { name?: string } };
    service_subcategories?: { name_en?: string };
  };
  return <>
    <Link href="/professional/requests" className="dashboard-back"><ArrowLeft size={16} /> Back to invitations</Link>
    <div className="dashboard-heading"><div><span className="section-kicker">{request.request_reference}</span><h1>{request.title}</h1><p>{request.description}</p></div><span className="status-chip">{request.urgency}</span></div>
    <div className="metric-grid">
      <article className="metric-card"><MapPinHouse size={20} /><span>Approximate area</span><strong>{request.service_zones?.name}, {request.service_zones?.cities?.name}</strong></article>
      <article className="metric-card"><ShieldCheck size={20} /><span>Privacy</span><strong>Exact address released after confirmation</strong></article>
      <article className="metric-card"><span>Schedule</span><strong>{request.preferred_date} · {request.preferred_start_time}–{request.preferred_end_time || "flexible"}</strong></article>
    </div>
    <OfferForm requestId={request.id} />
  </>;
}
