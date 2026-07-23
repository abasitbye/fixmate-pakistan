"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

import { useRouter } from "@/i18n/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function logout() {
    setPending(true);
    await fetch("/api/v1/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/auth/sign-in");
    router.refresh();
  }
  return <button className="dashboard-logout" onClick={logout} disabled={pending}><LogOut size={17} /> {pending ? "Signing out…" : "Sign out"}</button>;
}
