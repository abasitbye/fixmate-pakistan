import "server-only";

import { createCipheriv, createHash, randomBytes } from "node:crypto";

import { getServerEnvironment } from "@/env/server";

export function encryptSensitiveValue(value: string) {
  const key = createHash("sha256").update(getServerEnvironment().DATA_ENCRYPTION_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}
