-- Payment commands retain a minimal response envelope for exact replay.
-- Phase 2's original idempotency table used response_body_safe and required an
-- explicit expiry. This forward-only compatibility column/default keeps the
-- financial command contracts isolated without changing earlier commands.

alter table public.idempotency_keys
  add column if not exists response_body jsonb,
  alter column expires_at set default (now() + interval '24 hours');

comment on column public.idempotency_keys.response_body is
  'Minimal financial command replay envelope; never store secrets or provider payloads.';
