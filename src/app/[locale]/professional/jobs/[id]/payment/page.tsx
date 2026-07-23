import { notFound, redirect } from "next/navigation";

import { PaymentPanel } from "@/components/marketplace/payment-panel";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { getJobPayment } from "@/lib/marketplace/payments/service";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function ProfessionalPaymentPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: localeValue, id } = await params;
  const locale = localeValue as AppLocale;
  const context = await requireAccount(locale, ["professional"]);
  if (!await isMarketplaceFeatureEnabled("phase2.payments_enabled")) redirect(localizedPath(locale, "/professional"));
  const { data: job } = await context.supabase.from("jobs").select("id,job_reference,professional_id,status,job_completions(final_price_minor,customer_decision)").eq("id", id).single();
  if (!job || job.professional_id !== context.profile.id || job.status !== "completed") notFound();
  const completion = Array.isArray(job.job_completions) ? job.job_completions[0] : job.job_completions;
  const { data: payment } = await getJobPayment(context, id);
  return <>
    <div className="dashboard-heading"><div><span className="section-kicker">Payment acknowledgement</span><h1>Job payment</h1><p>{job.job_reference} · You may report receipt, but only the customer or authorized staff can finalize payment.</p></div></div>
    <PaymentPanel jobId={id} role="professional" amountDueMinor={Number(completion?.final_price_minor ?? 0)} payment={payment as never} />
  </>;
}
