import { redirect } from "next/navigation";

import { RefundActions } from "@/components/marketplace/finance-operations";
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

export default async function AdminRefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/admin"));
  const { data } = await context.supabase
    .from("refunds")
    .select(
      "id,refund_reference,amount_minor,reason,status,provider_reference,created_at",
    )
    .order("created_at", { ascending: false });
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Refund control</span>
          <h1>Refunds</h1>
          <p>
            Approve and record manual refunds without overwriting completed
            ledger history.
          </p>
        </div>
      </div>
      <div className="card-list">
        {(data ?? []).map((refund) => (
          <article className="panel-card" key={refund.id}>
            <h2>{refund.refund_reference}</h2>
            <p>
              <strong>{money(refund.amount_minor)}</strong> · {refund.reason}
            </p>
            <span className="status-chip">{refund.status}</span>
            <RefundActions refundId={refund.id} status={refund.status} />
          </article>
        ))}
        {!data?.length ? (
          <article className="panel-card">
            <h2>No refunds</h2>
            <p>Customer refund requests will appear here.</p>
          </article>
        ) : null}
      </div>
    </>
  );
}
