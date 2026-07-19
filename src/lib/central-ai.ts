import crypto from "crypto";
import { agentServiceFetch, createAgentContextToken } from "@/lib/agent-client";
import { decryptSecret } from "@/lib/credential-vault";
import { executeQuery, executeSingle } from "@/lib/tidb";

type Message = { role: "system" | "user" | "assistant"; content: string };

async function recordUsage(query: string, values: unknown[]) {
  try {
    await executeSingle(query, values);
  } catch (error) {
    // Telemetry must never change an otherwise valid provider result or error classification.
    console.error("AI usage telemetry write failed", { code: error instanceof Error ? error.name : "UNKNOWN" });
  }
}

export async function generateCentralText(userId: string, messages: Message[], options: { temperature?: number; maxTokens?: number; jsonMode?: boolean; outputSchema?: Record<string, unknown>; feature?: string } = {}) {
  const startedAt = Date.now();
  const traceId = crypto.randomUUID();
  if (!process.env.AGENT_SERVICE_URL) throw new Error("AGENT_SERVICE_URL is not configured");
  const preferences = await executeQuery<any>(`SELECT default_provider, allow_built_in_fallback FROM user_ai_preferences WHERE user_id = ?`, [userId]);
  const providerMode = preferences[0]?.default_provider || "built_in";
  let key: string | undefined;
  if (providerMode === "openai_byok") {
    const credentials = await executeQuery<any>(`SELECT encrypted_value, key_version FROM ai_credentials WHERE user_id = ? AND provider = 'openai' AND status = 'active'`, [userId]);
    if (!credentials[0]) throw new Error("OpenAI BYOK is selected but no valid key is connected");
    key = await decryptSecret({ ciphertext: credentials[0].encrypted_value, keyVersion: credentials[0].key_version });
  }
  const token = createAgentContextToken(userId, ["ai:generate"], { traceId });
  const response = await agentServiceFetch("/v1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId, ...(key ? { "X-OpenAI-Key": key } : {}) },
    body: JSON.stringify({ messages, provider_mode: providerMode, allow_built_in_fallback: Boolean(preferences[0]?.allow_built_in_fallback), temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 3000, json_mode: options.jsonMode ?? false, output_schema: options.outputSchema }),
    signal: AbortSignal.timeout(55_000),
  });
  const data = await response.json();
  if (!response.ok) {
    await recordUsage(`INSERT INTO ai_usage_events (trace_id, user_id, provider, model, feature, latency_ms, success, error_code) VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`, [traceId, userId, providerMode === "openai_byok" ? "openai" : "vertex", "unknown", options.feature || "generation", Date.now() - startedAt, `HTTP_${response.status}`]);
    throw new Error(data.detail || data.error || "Central AI generation failed");
  }
  await recordUsage(`INSERT INTO ai_usage_events (trace_id, user_id, provider, model, feature, input_tokens, output_tokens, latency_ms, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`, [traceId, userId, String(data.provider || "unknown"), String(data.model || "unknown"), options.feature || "generation", Number(data.input_tokens || 0), Number(data.output_tokens || 0), Date.now() - startedAt]);
  return { content: String(data.content || ""), provider: String(data.provider || "unknown"), model: String(data.model || "unknown"), tokens: Number(data.tokens || 0) };
}

export function createCentralAIClient(userId: string, feature = "generation") {
  return {
    chat: {
      completions: {
        create: async (input: { model?: string; messages: Message[]; temperature?: number; max_tokens?: number; response_format?: unknown }) => {
          const responseFormat = input.response_format as { type?: string; json_schema?: { schema?: Record<string, unknown> } } | undefined;
          const result = await generateCentralText(userId, input.messages, { temperature: input.temperature, maxTokens: input.max_tokens, jsonMode: Boolean(input.response_format) || input.messages.some((message) => /valid JSON|Return JSON|JSON response/i.test(message.content)), outputSchema: responseFormat?.json_schema?.schema, feature });
          return { choices: [{ message: { content: result.content } }], usage: { total_tokens: result.tokens }, provider: result.provider, model: result.model };
        },
      },
    },
  };
}
