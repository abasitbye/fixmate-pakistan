import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false, follow: false } };

export default function VerifyPage() {
  return (
    <AuthShell eyebrow="Email verification" title="A safer sign-in without passwords." lead="Every code is short-lived, single-use, and verified directly with FixMate’s authentication provider.">
      <VerifyForm />
    </AuthShell>
  );
}
