import crypto from "crypto";
import { executeQuery, executeSingle } from "@/lib/tidb";
import { encryptSecret } from "@/lib/credential-vault";
import { ApiError } from "@/lib/request-auth";

export type AIProviderPreference = "built_in" | "openai_byok";

export const aiPreferencesService = {
  async get(userId: string) {
    const preferences = await executeQuery<any>(`SELECT * FROM user_ai_preferences WHERE user_id = ?`, [userId]);
    const credentials = await executeQuery<any>(`SELECT provider, last_four, status, validated_at, updated_at FROM ai_credentials WHERE user_id = ? AND provider = 'openai'`, [userId]);
    return {
      defaultProvider: preferences[0]?.default_provider || "built_in",
      allowBuiltInFallback: Boolean(preferences[0]?.allow_built_in_fallback),
      credentials: credentials.map((credential) => ({ provider: credential.provider, lastFour: credential.last_four, status: credential.status, validatedAt: credential.validated_at, updatedAt: credential.updated_at })),
    };
  },

  async update(userId: string, input: { defaultProvider: AIProviderPreference; allowBuiltInFallback: boolean }) {
    const credentials = await executeQuery<any>(`SELECT provider, status FROM ai_credentials WHERE user_id = ?`, [userId]);
    if (input.defaultProvider === "openai_byok" && !credentials.some((item) => item.provider === "openai" && item.status === "active")) throw new ApiError(400, "Connect a valid OpenAI API key first", "OPENAI_KEY_REQUIRED");
    await executeSingle(
      `INSERT INTO user_ai_preferences (user_id, default_provider, allow_built_in_fallback) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE default_provider = VALUES(default_provider), allow_built_in_fallback = VALUES(allow_built_in_fallback)`,
      [userId, input.defaultProvider, input.allowBuiltInFallback]
    );
    return this.get(userId);
  },

  async connectCredential(userId: string, provider: "openai", value: string) {
    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/models`, { headers: { Authorization: `Bearer ${value}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new ApiError(400, "OpenAI rejected this API key", "CREDENTIAL_INVALID");
    const encrypted = await encryptSecret(value);
    await executeSingle(
      `INSERT INTO ai_credentials (id, user_id, provider, encrypted_value, key_version, last_four, status, validated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE encrypted_value = VALUES(encrypted_value), key_version = VALUES(key_version), last_four = VALUES(last_four), status = 'active', validated_at = UTC_TIMESTAMP(), revoked_at = NULL`,
      [crypto.randomUUID(), userId, provider, encrypted.ciphertext, encrypted.keyVersion, value.slice(-4)]
    );
    await executeSingle(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, 'credential.connected', 'ai_credential', ?, JSON_OBJECT('provider', ?))`, [userId, `${userId}:${provider}`, provider]);
    return this.get(userId);
  },

  async revokeCredential(userId: string, provider: "openai") {
    await executeSingle(`UPDATE ai_credentials SET status = 'revoked', encrypted_value = '', revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND provider = ?`, [userId, provider]);
    await executeSingle(`UPDATE user_ai_preferences SET default_provider = 'built_in' WHERE user_id = ?`, [userId]);
    return this.get(userId);
  },
};
