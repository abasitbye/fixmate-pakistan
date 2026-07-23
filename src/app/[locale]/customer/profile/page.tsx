import type { Metadata } from "next";
import { Mail, Phone, UserRound } from "lucide-react";

import { getAuthenticatedContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Customer profile", robots: { index: false, follow: false } };

export default async function CustomerProfilePage() {
  const context = await getAuthenticatedContext();
  return <><div className="dashboard-heading"><div><span className="section-kicker">Personal details</span><h1>Your profile</h1><p>Private account information used for secure communication and service support.</p></div></div><section className="panel-card profile-summary"><span className="profile-avatar"><UserRound size={30} /></span><div><h2>{context?.profile.display_name}</h2><p><Mail size={16} /> {context?.profile.email}</p><p><Phone size={16} /> {context?.profile.phone || "No phone added"}</p></div><span className="status-chip status-chip--success">Verified email</span></section></>;
}
