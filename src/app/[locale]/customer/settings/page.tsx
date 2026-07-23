import type { Metadata } from "next";
import { BellRing, Globe2, ShieldCheck } from "lucide-react";
import { PushRegistration } from "@/components/notifications/push-registration";

export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };

export default function CustomerSettingsPage() {
  return <><div className="dashboard-heading"><div><span className="section-kicker">Preferences</span><h1>Account settings</h1><p>Control communication preferences and review account protection.</p></div></div><div className="settings-list"><PushRegistration/><article className="panel-card setting-row"><span className="panel-icon"><BellRing size={20} /></span><div><h2>Transactional notifications</h2><p>Essential security and application emails remain enabled.</p></div><span className="status-chip status-chip--success">Enabled</span></article><article className="panel-card setting-row"><span className="panel-icon"><Globe2 size={20} /></span><div><h2>Language</h2><p>Use the language selector above to switch English, Urdu or Roman Urdu.</p></div></article><article className="panel-card setting-row"><span className="panel-icon"><ShieldCheck size={20} /></span><div><h2>Session security</h2><p>FixMate uses short-lived, refreshable Supabase sessions in secure cookies.</p></div></article></div></>;
}
