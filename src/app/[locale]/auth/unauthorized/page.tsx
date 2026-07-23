import { LockKeyhole } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Link } from "@/i18n/navigation";

export default function UnauthorizedPage() {
  return <AuthShell eyebrow="Protected area" title="That page is not available to this account." lead="FixMate checks permissions on both the page and API, so navigation alone can never grant access."><div className="status-panel"><span className="status-panel__icon"><LockKeyhole size={26} /></span><h2>Permission required</h2><p>Return to your dashboard, or sign in with an authorized account.</p><Link className="button button--primary button--large" href="/auth/sign-in">Go to sign in</Link></div></AuthShell>;
}
