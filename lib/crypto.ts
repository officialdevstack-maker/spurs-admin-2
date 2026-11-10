import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey() {
  const encoded = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }

  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }

  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64"))
    .join(".");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9+/]*={0,2}$/.test(part))) {
    throw new Error("Stored secret has an invalid format");
  }

  const [encodedIv, encodedTag, encodedData] = parts;
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64"));
  if (
    iv.length !== 12 ||
    tag.length !== 16 ||
    iv.toString("base64") !== encodedIv ||
    tag.toString("base64") !== encodedTag ||
    encrypted.toString("base64") !== encodedData
  ) {
    throw new Error("Stored secret has an invalid format");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
