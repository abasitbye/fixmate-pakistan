const sensitiveKeyPattern =
  /password|otp|token|access_token|refresh_token|authorization|cookie|cnic|national_id|address|bank_account|wallet|private_key|service_role/i;

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MAX_DEPTH]";
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : redactSensitiveData(entry, depth + 1),
    ]),
  );
}

