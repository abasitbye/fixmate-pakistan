import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

import { PropertyForm } from "@/components/customer/property-form";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { title: "Add property", robots: { index: false, follow: false } };

export default function NewPropertyPage() {
  return <><Link href="/customer/properties" className="dashboard-back"><ArrowLeft size={16} /> Back to properties</Link><div className="dashboard-heading"><div><span className="section-kicker">Secure address book</span><h1>Add a property</h1><p>Use accurate information. Coordinates are optional and will never be shown publicly.</p></div></div><PropertyForm /></>;
}
