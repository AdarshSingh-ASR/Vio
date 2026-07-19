import crypto from "crypto";
import { KeyManagementServiceClient } from "@google-cloud/kms";

export interface EncryptedSecret { ciphertext: string; keyVersion: string }

function localKey() {
  const configured = process.env.AI_CREDENTIAL_ENCRYPTION_KEY;
  if (!configured) throw new Error("KMS_KEY_NAME or AI_CREDENTIAL_ENCRYPTION_KEY must be configured");
  const key = Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

export async function encryptSecret(value: string): Promise<EncryptedSecret> {
  if (process.env.KMS_KEY_NAME) {
    const client = new KeyManagementServiceClient();
    const [result] = await client.encrypt({ name: process.env.KMS_KEY_NAME, plaintext: Buffer.from(value) });
    if (!result.ciphertext) throw new Error("Cloud KMS returned no ciphertext");
    return { ciphertext: Buffer.from(result.ciphertext as Uint8Array).toString("base64"), keyVersion: process.env.KMS_KEY_NAME };
  }
  if (process.env.NODE_ENV === "production") throw new Error("Cloud KMS is required for credentials in production");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", localKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64"), keyVersion: "local-aes-gcm-v1" };
}

export async function decryptSecret(secret: EncryptedSecret): Promise<string> {
  if (secret.keyVersion !== "local-aes-gcm-v1") {
    const client = new KeyManagementServiceClient();
    const [result] = await client.decrypt({ name: secret.keyVersion, ciphertext: Buffer.from(secret.ciphertext, "base64") });
    if (!result.plaintext) throw new Error("Cloud KMS returned no plaintext");
    return Buffer.from(result.plaintext as Uint8Array).toString("utf8");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Local credential encryption is not permitted in production");
  const payload = Buffer.from(secret.ciphertext, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", localKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}
