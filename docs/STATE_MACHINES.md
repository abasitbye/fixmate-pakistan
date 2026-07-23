# Marketplace State Machines

Database functions are authoritative. UI buttons and realtime updates never bypass these transitions.

## Request and offer

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> submitted
  submitted --> matching
  matching --> offers_received
  matching --> no_match
  offers_received --> professional_selected
  professional_selected --> converted_to_booking
  draft --> cancelled
  submitted --> cancelled
  matching --> expired
  offers_received --> expired
```

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> submitted
  submitted --> accepted
  submitted --> withdrawn
  submitted --> expired
  submitted --> rejected
```

## Booking and job

```mermaid
stateDiagram-v2
  [*] --> pending_confirmation
  pending_confirmation --> confirmed
  confirmed --> reschedule_requested
  reschedule_requested --> rescheduled
  rescheduled --> confirmed
  confirmed --> converted_to_job
  pending_confirmation --> cancelled
  confirmed --> cancelled
  confirmed --> customer_no_show
  confirmed --> professional_no_show
```

```mermaid
stateDiagram-v2
  [*] --> created
  created --> confirmed
  confirmed --> en_route
  en_route --> arrived
  arrived --> inspecting
  inspecting --> awaiting_quotation
  awaiting_quotation --> awaiting_approval
  awaiting_approval --> approved
  approved --> in_progress
  in_progress --> paused
  paused --> in_progress
  in_progress --> completion_submitted
  completion_submitted --> completed
  completed --> warranty_active
  completed --> disputed
  warranty_active --> disputed
  completed --> closed
  warranty_active --> closed
```

## Payment, warranty and dispute

```mermaid
stateDiagram-v2
  [*] --> cash_due
  cash_due --> cash_reported
  cash_reported --> cash_confirmed
  cash_reported --> cash_disputed
  cash_disputed --> cash_due
  created --> pending
  pending --> paid
  paid --> partially_refunded
  paid --> refunded
```

```mermaid
stateDiagram-v2
  [*] --> submitted
  submitted --> professional_response_requested
  professional_response_requested --> revisit_scheduled
  revisit_scheduled --> remedial_work_in_progress
  remedial_work_in_progress --> resolved
  submitted --> rejected
  submitted --> escalated_to_dispute
```

```mermaid
stateDiagram-v2
  [*] --> open
  open --> awaiting_customer
  open --> awaiting_professional
  open --> under_review
  under_review --> mediation
  mediation --> resolution_proposed
  resolution_proposed --> resolved
  resolved --> closed
  resolved --> reopened
  closed --> reopened
  reopened --> under_review
```
