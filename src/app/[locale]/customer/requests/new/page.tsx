import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { RequestForm } from "@/components/customer/request-form";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { requireAccount } from "@/lib/auth/guards";
import { isMarketplaceFeatureEnabled } from "@/lib/marketplace/feature-flags";
import { localizedPath } from "@/lib/routing/localized-path";

export default async function NewRequestPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = (await params).locale as AppLocale;
  await requireAccount(locale, ["customer"]);
  if (!await isMarketplaceFeatureEnabled("phase2.requests_enabled")) redirect(localizedPath(locale, "/customer"));
  return <>
    <Link href="/customer/requests" className="dashboard-back"><ArrowLeft size={16} /> Back to requests</Link>
    <div className="dashboard-heading"><div><span className="section-kicker">Guided request</span><h1>What needs fixing?</h1><p>Save a secure draft, add media, then review everything before submission.</p></div></div>
    <RequestForm />
  </>;
}
