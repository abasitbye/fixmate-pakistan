import { Bell, BriefcaseBusiness, Building2, House, LayoutDashboard, MapPinHouse, Settings, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Link } from "@/i18n/navigation";

import { LogoutButton } from "./logout-button";

const customerLinks = [
  { href: "/customer", label: "Overview", icon: LayoutDashboard },
  { href: "/customer/properties", label: "Properties", icon: MapPinHouse },
  { href: "/customer/profile", label: "Profile", icon: UserRound },
  { href: "/customer/notifications", label: "Notifications", icon: Bell },
  { href: "/customer/settings", label: "Settings", icon: Settings },
] as const;

export function DashboardShell({ children, displayName, roles, section = "customer" }: { children: ReactNode; displayName: string | null; roles: string[]; section?: "customer" | "professional" | "admin" | "support" }) {
  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <BrandMark />
        <nav aria-label="Dashboard navigation">
          {customerLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label}</Link>)}
          {roles.includes("professional") || section === "professional" ? <Link href="/professional"><BriefcaseBusiness size={18} />Professional</Link> : null}
          {roles.some((role) => ["admin", "super_admin"].includes(role)) ? <Link href="/admin"><Building2 size={18} />Administration</Link> : null}
        </nav>
        <LogoutButton />
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="dashboard-mobile-brand"><House size={18} /> FixMate</span></div>
          <div className="dashboard-user"><LanguageSwitcher /><span><small>Signed in as</small><strong>{displayName || "FixMate user"}</strong></span></div>
        </header>
        <main id="main-content" className="dashboard-content">{children}</main>
        <nav className="dashboard-bottom-nav" aria-label="Mobile dashboard navigation">
          <Link href="/customer"><LayoutDashboard size={19} /><span>Home</span></Link>
          <Link href="/customer/properties"><MapPinHouse size={19} /><span>Properties</span></Link>
          <Link href="/customer/notifications"><Bell size={19} /><span>Updates</span></Link>
          <Link href="/customer/settings"><Settings size={19} /><span>Settings</span></Link>
        </nav>
      </div>
    </div>
  );
}
