import { redirect } from "next/navigation";

import {
  CreatePayoutButton,
  PayoutActions,
} from "@/components/marketplace/finance-operations";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

function money(value: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export default async function AdminPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/admin"));
  const [{ data: payouts }, { data: earnings }] = await Promise.all([
    context.supabase
      .from("professional_payouts")
      .select(
        "id,payout_reference,professional_id,amount_minor,status,requested_by,approved_by,provider_reference,created_at",
      )
      .order("created_at", { ascending: false }),
    context.supabase
      .from("professional_earnings")
      .select(
        "id,professional_id,net_amount_minor,status,requires_payout,jobs(job_reference)",
      )
      .eq("status", "available")
      .eq("requires_payout", true)
      .order("created_at"),
  ]);
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Maker-checker settlements</span>
          <h1>Professional payouts</h1>
          <p>
            Draft creation, independent approval, private evidence, and manual
            settlement recording. No live payout provider is claimed.
          </p>
        </div>
      </div>
      <section className="panel-card">
        <h2>Available earnings</h2>
        {(earnings ?? []).map((earning) => (
          <div className="setting-row" key={earning.id}>
            <div>
              <strong>{money(earning.net_amount_minor)}</strong>
              <p>Professional {earning.professional_id}</p>
            </div>
            <CreatePayoutButton
              professionalId={earning.professional_id}
              earningId={earning.id}
            />
          </div>
        ))}
        {!earnings?.length ? (
          <p>No earnings are currently available for payout.</p>
        ) : null}
      </section>
      <div className="card-list">
        {(payouts ?? []).map((payout) => (
          <article className="panel-card" key={payout.id}>
            <h2>{payout.payout_reference}</h2>
            <p>
              <strong>{money(payout.amount_minor)}</strong> · Professional{" "}
              {payout.professional_id}
            </p>
            <span className="status-chip">{payout.status}</span>
            <PayoutActions payoutId={payout.id} status={payout.status} />
          </article>
        ))}
        {!payouts?.length ? (
          <article className="panel-card">
            <h2>No payout records</h2>
            <p>Approved manual settlement records will appear here.</p>
          </article>
        ) : null}
      </div>
    </>
  );
}
