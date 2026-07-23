import { redirect } from "next/navigation";

import { ReconciliationActions } from "@/components/marketplace/finance-operations";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function AdminReconciliationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/admin"));
  const { data } = await context.supabase
    .from("payment_reconciliation_cases")
    .select(
      "id,reason,status,resolution,opened_at,payment_intents(payment_reference,amount_minor,currency_code,status)",
    )
    .order("created_at", { ascending: false });
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Controlled review</span>
          <h1>Payment reconciliation</h1>
          <p>
            Resolve customer disagreements with evidence and a documented
            reason. Decisions post atomically.
          </p>
        </div>
      </div>
      <div className="card-list">
        {(data ?? []).map((item) => (
          <article className="panel-card" key={item.id}>
            <h2>
              {(Array.isArray(item.payment_intents)
                ? item.payment_intents[0]
                : item.payment_intents
              )?.payment_reference ?? "Payment case"}
            </h2>
            <p>{item.reason}</p>
            <span className="status-chip">{item.status}</span>
            {["open", "under_review"].includes(item.status) ? (
              <ReconciliationActions caseId={item.id} />
            ) : (
              <p>{item.resolution}</p>
            )}
          </article>
        ))}
        {!data?.length ? (
          <article className="panel-card">
            <h2>No reconciliation cases</h2>
            <p>Customer payment disagreements will appear here.</p>
          </article>
        ) : null}
      </div>
    </>
  );
}
