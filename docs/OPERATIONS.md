# Production operations

GitHub `main` deploys to `https://fixmate-pakistan.vercel.app`.

## Release

1. Run `pnpm check`, `pnpm db:status`, and `pnpm db:verify`.
2. Apply pending migrations with `pnpm db:migrate`.
3. Scan staged files for credentials and run `git diff --check`.
4. Commit and push `main`.
5. Wait for Vercel `Ready`; verify `/api/health` and production headers.
6. Exercise English, Urdu RTL, Roman Urdu, auth, protected redirects, public APIs, and Sentry.

The daily marketplace maintenance route and all production runbooks are documented in [RUNBOOKS.md](RUNBOOKS.md). Staff review workload, overdue disputes, background runs and explainable abuse signals from the Operations workspace.

Migrations are forward-only and checksummed. Never edit an applied migration; add a compensating migration. A Vercel code rollback does not reverse database state.

Supabase custom SMTP uses Resend and the OTP template contains `{{ .Token }}`. Firebase Cloud Messaging delivers notifications only; it never authenticates users.
