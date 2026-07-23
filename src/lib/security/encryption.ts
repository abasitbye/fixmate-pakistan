import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getServerEnvironment } from "@/env/server";

export function encryptSensitiveValue(value: string) {
  const key = createHash("sha256").update(getServerEnvironment().DATA_ENCRYPTION_KEY).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSensitiveValue(value: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = value.split(".");
  if (
    version !== "v1"
    || !encodedIv
    || !encodedTag
    || !encodedCiphertext
    || extra.length
  ) {
    throw new Error("Unsupported encrypted value.");
  }
  const key = createHash("sha256").update(getServerEnvironment().DATA_ENCRYPTION_KEY).digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
