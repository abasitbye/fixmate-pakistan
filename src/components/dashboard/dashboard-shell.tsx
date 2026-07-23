import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  Headphones,
  House,
  LayoutDashboard,
  MapPinHouse,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
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

const professionalLinks = [
  { href: "/professional", label: "Overview", icon: LayoutDashboard },
  { href: "/professional/application", label: "Application", icon: ClipboardCheck },
  { href: "/professional/profile", label: "Profile", icon: UserRound },
  { href: "/professional/notifications", label: "Notifications", icon: Bell },
  { href: "/professional/settings", label: "Settings", icon: Settings },
] as const;

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/professionals", label: "Professionals", icon: ClipboardCheck },
  { href: "/admin/customers", label: "Customers", icon: UsersRound },
  { href: "/admin/services", label: "Services", icon: Wrench },
  { href: "/admin/locations", label: "Locations", icon: MapPinHouse },
  { href: "/admin/roles", label: "Roles", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
] as const;

const supportLinks = [
  { href: "/support", label: "Overview", icon: Headphones },
  { href: "/support/users", label: "Users", icon: UsersRound },
  { href: "/support/applications", label: "Applications", icon: ClipboardCheck },
  { href: "/support/notes", label: "Support notes", icon: ScrollText },
] as const;

const sectionLinks = {
  customer: customerLinks,
  professional: professionalLinks,
  admin: adminLinks,
  support: supportLinks,
} as const;

export function DashboardShell({ children, displayName, roles, section = "customer" }: { children: ReactNode; displayName: string | null; roles: string[]; section?: "customer" | "professional" | "admin" | "support" }) {
  const navigationLinks = sectionLinks[section];
  const mobileLinks = navigationLinks.slice(0, 4);

  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <BrandMark />
        <nav aria-label="Dashboard navigation">
          {navigationLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label}</Link>)}
          {section !== "customer" ? <Link href="/customer"><House size={18} />Customer workspace</Link> : null}
          {section !== "professional" && roles.includes("professional") ? <Link href="/professional"><BriefcaseBusiness size={18} />Professional workspace</Link> : null}
          {section !== "admin" && roles.some((role) => ["admin", "super_admin"].includes(role)) ? <Link href="/admin"><Building2 size={18} />Administration</Link> : null}
          {section !== "support" && roles.some((role) => ["support", "admin", "super_admin"].includes(role)) ? <Link href="/support"><Headphones size={18} />Support workspace</Link> : null}
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
          {mobileLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={href}><Icon size={19} /><span>{label}</span></Link>)}
        </nav>
      </div>
    </div>
  );
}
