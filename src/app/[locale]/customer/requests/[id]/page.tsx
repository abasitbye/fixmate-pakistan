import { ArrowLeft, CalendarClock, MapPinHouse, Wrench } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { RequestActions } from "@/components/customer/request-actions";
import { RequestMedia } from "@/components/customer/request-media";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getCustomerRequest } from "@/lib/marketplace/requests/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function RequestDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) redirect(localizedPath(locale, "/customer"));
  const { data: request } = await getCustomerRequest(context, id);
  if (!request) notFound();
  const category = request.service_categories as unknown as { name_en?: string } | null;
  const subcategory = request.service_subcategories as unknown as { name_en?: string } | null;
  const property = request.properties as unknown as { label?: string } | null;
  return <>
    <Link href="/customer/requests" className="dashboard-back"><ArrowLeft size={16} /> Back to requests</Link>
    <div className="dashboard-heading"><div><span className="section-kicker">{request.request_reference}</span><h1>{request.title}</h1><p>{request.description}</p></div><span className="status-chip">{request.status.replaceAll("_", " ")}</span></div>
    <div className="metric-grid">
      <article className="metric-card"><Wrench size={20} /><span>Service</span><strong>{subcategory?.name_en ?? category?.name_en ?? "Service"}</strong></article>
      <article className="metric-card"><MapPinHouse size={20} /><span>Property</span><strong>{property?.label ?? "Private property"}</strong></article>
      <article className="metric-card"><CalendarClock size={20} /><span>Preferred schedule</span><strong>{String(request.preferred_date ?? "Not selected")} · {String(request.preferred_start_time ?? "")}</strong></article>
    </div>
    <div className="dashboard-grid">
      <RequestMedia requestId={request.id} status={request.status} media={(request.service_request_media ?? []) as unknown as Parameters<typeof RequestMedia>[0]["media"]} />
      <RequestActions requestId={request.id} version={request.version} status={request.status} />
    </div>
  </>;
}
