import { ClipboardList, Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { listCustomerRequests } from "@/lib/marketplace/requests/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function RequestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) redirect(localizedPath(locale, "/customer"));
  const { data } = await listCustomerRequests(context);
  return <>
    <div className="dashboard-heading"><div><span className="section-kicker">Service marketplace</span><h1>Your service requests</h1><p>Create, review, and track repair requests without exposing your exact address before selection.</p></div><Link className="button button--primary" href="/customer/requests/new"><Plus size={17} /> New request</Link></div>
    <div className="card-list">
      {(data ?? []).map((request) => <Link className="panel-card setting-row" href={`/customer/requests/${request.id}`} key={request.id}>
        <span className="panel-icon"><ClipboardList size={20} /></span>
        <div><h2>{request.title}</h2><p>{request.request_reference} · {String(request.preferred_date ?? "Schedule not set")}</p></div>
        <span className="status-chip">{request.status.replaceAll("_", " ")}</span>
      </Link>)}
      {!data?.length ? <article className="panel-card empty-action"><span className="panel-icon"><ClipboardList size={24} /></span><div><h2>No service requests yet</h2><p>Start with a saved property and a clear description of the problem.</p><Link className="button button--primary" href="/customer/requests/new">Create your first request</Link></div></article> : null}
    </div>
  </>;
}
