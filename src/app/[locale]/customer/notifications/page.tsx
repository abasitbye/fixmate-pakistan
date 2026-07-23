import type { Metadata } from "next";
import { Bell } from "lucide-react";

import { getAuthenticatedContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

export default async function CustomerNotificationsPage() {
  const context = await getAuthenticatedContext();
  const { data } = context ? await context.supabase.from("notifications").select("id,title,body,type,read_at,created_at").eq("user_profile_id", context.profile.id).order("created_at", { ascending: false }).limit(50) : { data: [] };
  const notifications = data ?? [];
  return <><div className="dashboard-heading"><div><span className="section-kicker">Updates</span><h1>Notifications</h1><p>Important account and application changes appear here.</p></div></div>{notifications.length ? <div className="card-list">{notifications.map((item) => <article className="panel-card notification-card" key={item.id}><span className="panel-icon"><Bell size={20} /></span><div><h2>{item.title}</h2><p>{item.body}</p><small>{new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(new Date(item.created_at))}</small></div>{!item.read_at ? <span className="unread-dot" aria-label="Unread" /> : null}</article>)}</div> : <div className="panel-card empty-state"><span className="panel-icon"><Bell size={25} /></span><h2>You’re all caught up</h2><p>Account and professional application updates will appear here.</p></div>}</>;
}
