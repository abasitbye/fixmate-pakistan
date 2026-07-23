# FixMate Pakistan

FixMate Pakistan is a managed home-services platform for Islamabad and Rawalpindi. The platform is web-first and API-first so future Android and iOS applications can reuse the same contracts and business rules.

Production: [fixmate-pakistan.vercel.app](https://fixmate-pakistan.vercel.app)

## Phase 1

The foundation includes production deployment, email OTP, Turnstile abuse protection, roles, customer profiles and properties, guided professional verification, private documents, controlled review, support/admin tools, English/Urdu/Roman Urdu, notifications, PWA support, audit trails, and monitoring.

## Phase 2

Phase 2 adds service requests, privacy-preserving professional matching, offers, bookings, jobs, quotations, cash/manual payments, reviews, warranties, disputes, operational monitoring, scheduled lifecycle maintenance and human-reviewed abuse controls. Online payment is exposed only when a separately verified provider is configured.

## Stack

- Next.js App Router, React, TypeScript, next-intl
- Supabase Auth, PostgreSQL, Storage, and RLS
- Resend SMTP, Firebase Cloud Messaging, Cloudflare Turnstile
- Sentry and Vercel

## Setup and quality

Use Node.js 20.9+ and pnpm 11. Copy `.env.example` to ignored `.env.local`, install with `pnpm install`, then use `pnpm dev` for local engineering.

```bash
pnpm check
pnpm db:status
pnpm db:verify
```

Production, not localhost, is the acceptance environment.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Operations](docs/OPERATIONS.md)
- [Phase 2 marketplace](docs/PHASE2.md)
- [Data model](docs/DATA_MODEL.md)
- [State machines](docs/STATE_MACHINES.md)
- [Permission matrix](docs/PERMISSIONS.md)
- [Production runbooks](docs/RUNBOOKS.md)
- [Phase 3 deferrals](docs/PHASE3.md)
