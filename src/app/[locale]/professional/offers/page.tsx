import { BadgeDollarSign } from "lucide-react";
import { redirect } from "next/navigation";

import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { formatMoney, createMoney } from "@/lib/marketplace/money";
import { listProfessionalOffers } from "@/lib/marketplace/offers/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalOffersPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) redirect(localizedPath(locale, "/professional"));
  const { data } = await listProfessionalOffers(context);
  return <><div className="dashboard-heading"><div><span className="section-kicker">Commercial proposals</span><h1>Your offers</h1><p>Track submitted, accepted, withdrawn, rejected, and expired proposals.</p></div></div><div className="card-list">
    {(data ?? []).map((offer) => <article className="panel-card setting-row" key={offer.id}><span className="panel-icon"><BadgeDollarSign size={20} /></span><div><h2>{offer.offer_reference}</h2><p>{offer.message}</p></div><div><strong>{formatMoney(createMoney(offer.total_amount_minor ?? offer.inspection_fee_minor, offer.currency_code))}</strong><span className="status-chip">{offer.status}</span></div></article>)}
    {!data?.length ? <article className="panel-card"><h2>No offers yet</h2><p>Offers you send from matched service invitations will appear here.</p></article> : null}
  </div></>;
}
