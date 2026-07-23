import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";

import "../globals.css";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://fixmate-pakistan.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "FixMate Pakistan | Trusted Home Services",
    template: "%s | FixMate Pakistan",
  },
  description:
    "Connect with verified home-service professionals in Islamabad and Rawalpindi for reliable repairs and maintenance.",
  applicationName: "FixMate Pakistan",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FixMate", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "FixMate Pakistan",
    url: appUrl,
    title: "FixMate Pakistan | Trusted Home Services",
    description:
      "A verified professional, a clear price, a recorded job and support when something goes wrong.",
    images: [{ url: "/brand/fixmate-logo.png", width: 1254, height: 1254 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FixMate Pakistan",
    description: "Ghar Ka Kaam, FixMate Ke Naam.",
    images: ["/brand/fixmate-logo.png"],
  },
  icons: {
    icon: "/brand/fixmate-logo.png",
    apple: "/brand/fixmate-logo.png",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={locale === "ur" ? "rtl" : "ltr"}>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
