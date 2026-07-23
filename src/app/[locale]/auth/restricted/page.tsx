import type { Metadata } from "next";
import { CircleHelp, ShieldAlert } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Account restricted", robots: { index: false, follow: false } };

export default function RestrictedPage() {
  return (
    <AuthShell eyebrow="Account protection" title="This account needs attention." lead="Restricted accounts cannot access protected FixMate features until an authorized administrator resolves the account status.">
      <div className="status-panel"><span className="status-panel__icon"><ShieldAlert size={26} /></span><h2>Account access is restricted</h2><p>For privacy, we do not display sensitive account decisions here. Contact FixMate Support from your registered email address.</p><Link className="button button--primary button--large" href="/contact"><CircleHelp size={18} /> Contact support</Link></div>
    </AuthShell>
  );
}
