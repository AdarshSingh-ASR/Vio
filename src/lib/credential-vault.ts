import crypto from "crypto";

export interface EncryptedSecret { ciphertext: string; keyVersion: string }

function localKey() {
  const configured = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!configured) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be configured");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

export async function encryptSecret(value: string): Promise<EncryptedSecret> {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", localKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"), keyVersion: "local-aes-gcm-v1" };
}

export async function decryptSecret(secret: EncryptedSecret): Promise<string> {
  if (secret.keyVersion !== "local-aes-gcm-v1") throw new Error("This credential was encrypted with an unsupported key version and must be reconnected");
  const payload = Buffer.from(secret.ciphertext, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", localKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
