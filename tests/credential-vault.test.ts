import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/credential-vault";

describe("credential vault", () => {
  const env = { key: process.env.AI_CREDENTIAL_ENCRYPTION_KEY, kms: process.env.KMS_KEY_NAME };
  afterEach(() => { process.env.AI_CREDENTIAL_ENCRYPTION_KEY = env.key; process.env.KMS_KEY_NAME = env.kms; });

  it("encrypts without retaining plaintext and decrypts in local development", async () => {
    delete process.env.KMS_KEY_NAME;
    process.env.AI_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = await encryptSecret("sk-example-secret-value");
    expect(encrypted.ciphertext).not.toContain("sk-example");
    expect(await decryptSecret(encrypted)).toBe("sk-example-secret-value");
  });
});
