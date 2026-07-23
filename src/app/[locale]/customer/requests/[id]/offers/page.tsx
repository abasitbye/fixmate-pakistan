import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { OfferComparison } from "@/components/customer/offer-comparison";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getCustomerRequest } from "@/lib/marketplace/requests/service";
import { listCustomerOffers } from "@/lib/marketplace/offers/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function CustomerOffersPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) redirect(localizedPath(locale, "/customer"));
  const [{ data: request }, { data: offers }] = await Promise.all([
    getCustomerRequest(context, id),
    listCustomerOffers(context, id),
  ]);
  if (!request) notFound();
  return <>
    <Link href={`/customer/requests/${id}`} className="dashboard-back"><ArrowLeft size={16} /> Back to request</Link>
    <div className="dashboard-heading"><div><span className="section-kicker">{request.request_reference}</span><h1>Compare professional offers</h1><p>Review scope, schedule, verification, price, and warranty—not price alone.</p></div></div>
    <OfferComparison requestId={id} offers={(offers ?? []) as unknown as Parameters<typeof OfferComparison>[0]["offers"]} />
  </>;
}
