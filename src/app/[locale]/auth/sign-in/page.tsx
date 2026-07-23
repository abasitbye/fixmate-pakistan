import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Secure sign in", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <AuthShell eyebrow="Secure account access" title="Your trusted home-service account." lead="One private account for requesting services, saving properties, and building a verified professional profile.">
      <SignInForm />
    </AuthShell>
  );
}
