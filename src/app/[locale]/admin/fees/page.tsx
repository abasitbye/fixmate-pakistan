import { redirect } from "next/navigation";

import { FeeRuleForm } from "@/components/marketplace/fee-rule-form";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function AdminFeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = (await params).locale as AppLocale;
  const context = await requireAccount(locale, ["admin", "super_admin"]);
  if (!(await isMarketplaceFeatureEnabled("phase2.payments_enabled")))
    redirect(localizedPath(locale, "/admin"));
  const { data } = await context.supabase
    .from("fee_rules")
    .select("*")
    .order("effective_from", { ascending: false });
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <span className="section-kicker">Effective-dated configuration</span>
          <h1>Platform fee rules</h1>
          <p>
            Percentage, fixed, minimum, maximum, category, city, and effective
            dates are data—not hardcoded application values.
          </p>
        </div>
      </div>
      {context.roles.includes("super_admin") ? (
        <FeeRuleForm />
      ) : (
        <article className="panel-card">
          <h2>Read-only access</h2>
          <p>
            Only a super administrator can create or change high-risk fee rules.
          </p>
        </article>
      )}
      <div className="card-list">
        {(data ?? []).map((rule) => (
          <article className="panel-card setting-row" key={rule.id}>
            <div>
              <h2>{rule.name}</h2>
              <p>
                {rule.fee_type} · {rule.percentage_basis_points} basis points ·
                fixed {Number(rule.fixed_amount_minor) / 100} PKR
              </p>
            </div>
            <span className="status-chip">
              {rule.is_active ? "active" : "inactive"}
            </span>
          </article>
        ))}
        {!data?.length ? (
          <article className="panel-card">
            <h2>No active commission</h2>
            <p>
              Until an authorized rule is configured, the calculated platform
              fee is zero.
            </p>
          </article>
        ) : null}
      </div>
    </>
  );
}
