import { Clock3 } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Link } from "@/i18n/navigation";

export default function SessionExpiredPage() {
  return <AuthShell eyebrow="Session protection" title="Your secure session has ended." lead="Sessions expire to help protect your account, especially on shared devices."><div className="status-panel"><span className="status-panel__icon"><Clock3 size={26} /></span><h2>Please sign in again</h2><p>Your work is saved where draft saving is supported.</p><Link className="button button--primary button--large" href="/auth/sign-in">Return to sign in</Link></div></AuthShell>;
}
