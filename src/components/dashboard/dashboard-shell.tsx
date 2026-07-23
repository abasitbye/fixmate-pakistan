import {
  Activity,
  Bell,
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  ClipboardList,
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
import { getTranslations } from "next-intl/server";
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
  { href: "/admin/operations", label: "Operations", icon: Activity },
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
  { href: "/support/operations", label: "Operations", icon: Activity },
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

export async function DashboardShell({
  children,
  displayName,
  roles,
  section = "customer",
  marketplaceNavigation,
}: {
  children: ReactNode;
  displayName: string | null;
  roles: string[];
  section?: "customer" | "professional" | "admin" | "support";
  marketplaceNavigation?: { requests: boolean; matching: boolean; jobs: boolean; payments: boolean; resolution: boolean };
}) {
  const t = await getTranslations("Dashboard");
  const label = (value: string) => {
    const keys: Record<string, string> = {
      Overview: "overview",
      Properties: "properties",
      Profile: "profile",
      Notifications: "notifications",
      Settings: "settings",
      Application: "application",
      Professionals: "professionals",
      Customers: "customers",
      Services: "services",
      Locations: "locations",
      Roles: "roles",
      "Audit log": "auditLog",
      Users: "users",
      Applications: "applications",
      "Support notes": "supportNotes",
      Requests: "requests",
      Bookings: "bookings",
      Jobs: "jobs",
      Payments: "payments",
      Receipts: "receipts",
      Invitations: "invitations",
      Offers: "offers",
      Earnings: "earnings",
      Payouts: "payouts",
      Warranties: "warranties",
      Disputes: "disputes",
      Reconciliation: "reconciliation",
      Refunds: "refunds",
      "Fee rules": "feeRules",
      Reviews: "reviews",
      Operations: "operations",
    };
    return keys[value] ? t(keys[value]) : value;
  };
  let navigationLinks = [...sectionLinks[section]] as Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
  if (section === "customer") {
    const marketplaceLinks = [
      ...(marketplaceNavigation?.requests ? [{ href: "/customer/requests", label: "Requests", icon: ClipboardList }] : []),
      ...(marketplaceNavigation?.jobs ? [
        { href: "/customer/bookings", label: "Bookings", icon: CalendarCheck2 },
        { href: "/customer/jobs", label: "Jobs", icon: Wrench },
      ] : []),
      ...(marketplaceNavigation?.payments ? [
        { href: "/customer/payments", label: "Payments", icon: BadgeDollarSign },
        { href: "/customer/receipts", label: "Receipts", icon: ScrollText },
      ] : []),
    ];
    navigationLinks = [navigationLinks[0], ...marketplaceLinks, ...navigationLinks.slice(1)];
  }
  if (section === "professional") {
    const marketplaceLinks = [
      ...(marketplaceNavigation?.matching ? [
        { href: "/professional/requests", label: "Invitations", icon: ClipboardList },
        { href: "/professional/offers", label: "Offers", icon: BadgeDollarSign },
      ] : []),
      ...(marketplaceNavigation?.jobs ? [
        { href: "/professional/bookings", label: "Bookings", icon: CalendarCheck2 },
        { href: "/professional/jobs", label: "Jobs", icon: Wrench },
      ] : []),
      ...(marketplaceNavigation?.payments ? [
        { href: "/professional/earnings", label: "Earnings", icon: BadgeDollarSign },
        { href: "/professional/payouts", label: "Payouts", icon: ScrollText },
      ] : []),
      ...(marketplaceNavigation?.resolution ? [
        { href: "/professional/warranties", label: "Warranties", icon: ShieldCheck },
        { href: "/professional/disputes", label: "Disputes", icon: Headphones },
      ] : []),
    ];
    navigationLinks = [navigationLinks[0], ...marketplaceLinks, ...navigationLinks.slice(1)];
  }
  if (section === "support" && marketplaceNavigation?.jobs) {
    navigationLinks = [
      navigationLinks[0],
      { href: "/support/bookings", label: "Bookings", icon: CalendarCheck2 },
      ...navigationLinks.slice(1),
    ];
  }
  if (section === "support" && marketplaceNavigation?.payments) {
    navigationLinks.splice(2, 0, { href: "/support/payments", label: "Payments", icon: BadgeDollarSign });
  }
  if (section === "support" && marketplaceNavigation?.resolution) {
    navigationLinks.splice(3, 0, { href: "/support/warranties", label: "Warranties", icon: ShieldCheck }, { href: "/support/disputes", label: "Disputes", icon: Headphones });
  }
  if (section === "admin" && marketplaceNavigation?.payments) {
    navigationLinks = [
      navigationLinks[0],
      { href: "/admin/payments", label: "Payments", icon: BadgeDollarSign },
      { href: "/admin/reconciliation", label: "Reconciliation", icon: ClipboardList },
      { href: "/admin/refunds", label: "Refunds", icon: ScrollText },
      { href: "/admin/fees", label: "Fee rules", icon: Settings },
      { href: "/admin/payouts", label: "Payouts", icon: ScrollText },
      ...navigationLinks.slice(1),
    ];
  }
  if (section === "admin" && marketplaceNavigation?.resolution) {
    navigationLinks.splice(1, 0,
      { href: "/admin/reviews", label: "Reviews", icon: BadgeDollarSign },
      { href: "/admin/warranties", label: "Warranties", icon: ShieldCheck },
      { href: "/admin/disputes", label: "Disputes", icon: Headphones },
    );
  }
  const mobileLinks = navigationLinks.slice(0, 4);

  return (
    <div className="dashboard-frame">
      <aside className="dashboard-sidebar">
        <BrandMark />
        <nav aria-label={t("navigationLabel")}>
          {navigationLinks.map(({ href, label: linkLabel, icon: Icon }) => <Link href={href} key={href}><Icon size={18} />{label(linkLabel)}</Link>)}
          {section !== "customer" ? <Link href="/customer"><House size={18} />{t("customerWorkspace")}</Link> : null}
          {section !== "professional" && roles.includes("professional") ? <Link href="/professional"><BriefcaseBusiness size={18} />{t("professionalWorkspace")}</Link> : null}
          {section !== "admin" && roles.some((role) => ["admin", "super_admin"].includes(role)) ? <Link href="/admin"><Building2 size={18} />{t("administration")}</Link> : null}
          {section !== "support" && roles.some((role) => ["support", "admin", "super_admin"].includes(role)) ? <Link href="/support"><Headphones size={18} />{t("supportWorkspace")}</Link> : null}
        </nav>
        <LogoutButton />
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="dashboard-mobile-brand"><House size={18} /> FixMate</span></div>
          <div className="dashboard-user"><LanguageSwitcher /><span><small>{t("signedInAs")}</small><strong>{displayName || t("fixMateUser")}</strong></span></div>
        </header>
        <main id="main-content" className="dashboard-content">{children}</main>
        <nav className="dashboard-bottom-nav" aria-label={t("mobileNavigationLabel")}>
          {mobileLinks.map(({ href, label: linkLabel, icon: Icon }) => <Link href={href} key={href}><Icon size={19} /><span>{label(linkLabel)}</span></Link>)}
        </nav>
      </div>
    </div>
  );
}
