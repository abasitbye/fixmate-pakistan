# Phase 2 Data Model

The database is normalized around the service journey. Every user-facing or sensitive table has Row Level Security, and multi-record state changes run through controlled PostgreSQL functions.

```mermaid
erDiagram
  USER_PROFILES ||--o{ SERVICE_REQUESTS : creates
  PROPERTIES ||--o{ SERVICE_REQUESTS : used_for
  SERVICE_REQUESTS ||--o{ MATCHING_RUNS : matched_by
  MATCHING_RUNS ||--o{ REQUEST_MATCHING_CANDIDATES : ranks
  SERVICE_REQUESTS ||--o{ PROFESSIONAL_OFFERS : receives
  PROFESSIONAL_OFFERS ||--o| ACCEPTED_OFFER_SNAPSHOTS : freezes
  SERVICE_REQUESTS ||--o| BOOKINGS : converts_to
  BOOKINGS ||--o| JOBS : converts_to
  JOBS ||--o{ JOB_QUOTATIONS : receives
  JOBS ||--o{ JOB_CHANGE_ORDERS : changes
  JOBS ||--o{ JOB_MESSAGES : records
  JOBS ||--o{ PAYMENT_INTENTS : charges
  PAYMENT_INTENTS ||--o{ LEDGER_ENTRIES : posts
  PAYMENT_INTENTS ||--o| PROFESSIONAL_EARNINGS : earns
  JOBS ||--o{ JOB_REVIEWS : reviewed_by
  JOBS ||--o| JOB_WARRANTIES : may_issue
  JOB_WARRANTIES ||--o{ WARRANTY_CLAIMS : receives
  JOBS ||--o{ JOB_DISPUTES : may_raise
  JOB_DISPUTES ||--o{ DISPUTE_EVIDENCE : protects
  JOB_DISPUTES ||--o{ DISPUTE_DECISIONS : resolves
```

Money is stored as integer minor units with an ISO currency code. UTC is authoritative; displays use Asia/Karachi. Submitted quotations, audit records, accepted commercial snapshots, ledger entries, dispute evidence, and status histories are append-only or corrected through new records rather than overwritten.

Operational tables add explainable `marketplace_risk_signals`, `operational_alerts`, `background_job_runs`, `data_retention_policies`, and user-submitted `marketplace_abuse_reports`. Signals are review aids only and never create an automatic opaque ban.
