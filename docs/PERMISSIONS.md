# Marketplace Permission Matrix

| Capability | Customer | Approved professional | Support | Admin | Super admin |
| --- | --- | --- | --- | --- | --- |
| Create and manage own request | Yes | No | Read operational context | Read | Read |
| See exact address before selection | Own property only | No | Need-based | Need-based | Need-based |
| Receive invitation / submit offer | No | Own eligible invitations | Read operational context | Intervene with audit | Intervene with audit |
| Accept offer | Request owner | No | No | No | No |
| Confirm booking / arrive / perform work | View and decide | Assigned professional | Review/override where defined | Review | Review |
| Approve quotation/change order/completion | Job customer | Propose only | No | No | No |
| Confirm cash/manual payment | Paying customer | Report receipt only | Reconcile documented disagreement | Reconcile/refund | Reconcile/refund |
| View earnings/payout | No | Own records | Limited payment support | Operate maker-checker payouts | Operate maker-checker payouts |
| Submit review | Eligible participant | Eligible participant | Moderate | Moderate | Moderate |
| Open warranty claim/dispute | Eligible participant | Respond/open eligible dispute | Triage/mediate | Resolve | Resolve |
| View internal dispute evidence | No | No | Yes | Yes | Yes |
| Review risk signal | No | No | Yes, documented | Yes | Yes |
| Change roles/feature flags | No | No | No | Limited | Yes, audited |

RLS is the baseline. APIs add account state, role, ownership, validation, rate limiting, idempotency, concurrency, and controlled transition checks. The service-role key is never sent to a browser or mobile client.
