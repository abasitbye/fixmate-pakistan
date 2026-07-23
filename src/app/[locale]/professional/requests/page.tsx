import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listProfessionalInvitations } from "@/lib/marketplace/matching/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalRequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.matching_enabled")) redirect(localizedPath(locale, "/professional"));
  const { data } = await listProfessionalInvitations(context);
  return <><div className="dashboard-heading"><div><span className="section-kicker">Matched opportunities</span><h1>Service invitations</h1><p>Only requests matching your approved services, area, verification, and availability appear here.</p></div></div><div className="card-list">
    {(data ?? []).map((invitation) => {
      const request = invitation.service_requests as unknown as { title?: string; urgency?: string; preferred_date?: string; service_zones?: { name?: string } };
      return <Link className="panel-card setting-row" href={`/professional/requests/${invitation.id}`} key={invitation.id}><span className="panel-icon"><ClipboardList size={20} /></span><div><h2>{request.title}</h2><p>{request.service_zones?.name ?? "Approximate service area"} · {request.preferred_date} · {request.urgency}</p></div><span className="status-chip">{invitation.invitation_status}</span></Link>;
    })}
    {!data?.length ? <article className="panel-card"><h2>No active invitations</h2><p>Keep your availability and service areas current. Matching expands in controlled batches.</p></article> : null}
  </div></>;
}
