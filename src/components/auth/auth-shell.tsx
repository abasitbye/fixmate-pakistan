import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";

export function AuthShell({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="FixMate trust commitment">
        <BrandMark />
        <div>
          <span className="auth-aside__kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{lead}</p>
        </div>
        <p className="auth-aside__foot">Verified access · Private by design · Built for Pakistan</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}
