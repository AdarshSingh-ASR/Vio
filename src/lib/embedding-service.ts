import { agentServiceFetch, createAgentContextToken } from "@/lib/agent-client";

export async function createEmbeddings(
  userId: string,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
  token?: string,
) {
  if (!texts.length) return { vectors: [] as number[][], model: "" };
  const response = await agentServiceFetch("/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Vio-Agent-Token": token || createAgentContextToken(userId, ["ai:embed"]),
    },
    body: JSON.stringify({ texts, task_type: taskType }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Embedding service rejected the request (${response.status})`);
  const result = await response.json() as { vectors?: unknown; model?: unknown; dimensions?: unknown };
  if (!Array.isArray(result.vectors) || result.vectors.some((vector) => !Array.isArray(vector) || vector.length !== 768)) {
    throw new Error("Embedding service returned an invalid vector shape");
  }
  return { vectors: result.vectors as number[][], model: String(result.model || "unknown") };
}
