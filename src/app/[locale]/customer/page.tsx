import type { Metadata } from "next";
import { ArrowRight, Bell, CheckCircle2, HousePlus, MapPinHouse, ShieldCheck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getAuthenticatedContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Customer dashboard", robots: { index: false, follow: false } };

export default async function CustomerDashboardPage() {
  const context = await getAuthenticatedContext();
  if (!context) return null;
  const profileId = context.profile.id;
  const [{ count: propertyCount }, { count: notificationCount }] = await Promise.all([
    context.supabase.from("properties").select("id", { count: "exact", head: true }).eq("customer_profile_id", profileId).eq("is_active", true),
    context.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_profile_id", profileId).is("read_at", null),
  ]);

  return (
    <>
      <div className="dashboard-heading"><div><span className="section-kicker">Customer account</span><h1>Welcome, {context.profile.display_name?.split(" ")[0] || "there"}.</h1><p>Your FixMate foundation is ready. Job requests and matching arrive in Phase 2.</p></div><span className="status-chip status-chip--success"><CheckCircle2 size={16} /> Account ready</span></div>
      <section className="metric-grid" aria-label="Account summary">
        <article className="metric-card"><span><MapPinHouse size={21} /></span><strong>{propertyCount ?? 0}</strong><p>Saved properties</p></article>
        <article className="metric-card"><span><Bell size={21} /></span><strong>{notificationCount ?? 0}</strong><p>Unread notifications</p></article>
        <article className="metric-card"><span><ShieldCheck size={21} /></span><strong>Active</strong><p>Account status</p></article>
      </section>
      <section className="dashboard-grid dashboard-grid--main">
        <article className="panel-card empty-action"><span className="panel-icon"><HousePlus size={24} /></span><div><span className="section-kicker">Start here</span><h2>Add your first property</h2><p>Save your home or workplace securely now, so requesting a service is faster when the marketplace opens.</p><Link className="button button--primary" href="/customer/properties/new">Add a property <ArrowRight size={17} /></Link></div></article>
        <aside className="panel-card phase-card"><span className="section-kicker">Phase 1 boundary</span><h2>No pretend bookings</h2><p>Service requests, quotes, matching, jobs and payments are intentionally not active yet. FixMate will introduce those as connected Phase 2 workflows.</p></aside>
      </section>
    </>
  );
}
