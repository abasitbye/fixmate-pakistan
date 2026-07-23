import type { Metadata } from "next";
import { Building2, MapPin, Plus } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { getAuthenticatedContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Saved properties", robots: { index: false, follow: false } };

export default async function PropertiesPage() {
  const context = await getAuthenticatedContext();
  const { data } = context ? await context.supabase.from("properties").select("id,label,property_type,address_line_1,address_line_2,postal_code,is_default,cities(name)").eq("customer_profile_id", context.profile.id).eq("is_active", true).order("is_default", { ascending: false }) : { data: [] };
  const properties = data ?? [];
  return <><div className="dashboard-heading"><div><span className="section-kicker">Your locations</span><h1>Saved properties</h1><p>Only you and authorized FixMate operations can access exact property details.</p></div><Link className="button button--primary" href="/customer/properties/new"><Plus size={17} /> Add property</Link></div>{properties.length ? <div className="card-list">{properties.map((property) => <article className="panel-card property-card" key={property.id}><span className="panel-icon">{property.property_type === "office" ? <Building2 size={21} /> : <MapPin size={21} />}</span><div><div className="property-card__title"><h2>{property.label}</h2>{property.is_default ? <span className="status-chip">Default</span> : null}</div><p>{property.address_line_1}{property.address_line_2 ? `, ${property.address_line_2}` : ""}</p><small>{(property.cities as unknown as { name: string } | null)?.name}{property.postal_code ? ` · ${property.postal_code}` : ""}</small></div></article>)}</div> : <div className="panel-card empty-state"><span className="panel-icon"><MapPin size={25} /></span><h2>No saved properties yet</h2><p>Add a home, apartment, office or shop. You can choose a default property for future service requests.</p><Link className="button button--primary" href="/customer/properties/new"><Plus size={17} /> Add your first property</Link></div>}</>;
}
