import { createHash } from "node:crypto";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;

export function parseIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new IdempotencyKeyError();
  }
  return key;
}

export function hashIdempotentRequest(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

export class IdempotencyKeyError extends Error {
  readonly code = "IDEMPOTENCY_KEY_REQUIRED";

  constructor() {
    super("A valid Idempotency-Key header is required.");
  }
}
