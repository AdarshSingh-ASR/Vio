import crypto from "crypto";
import { GoogleAuth } from "google-auth-library";

export type AgentTokenScope = { runId?: string; conversationId?: string; traceId?: string };

export async function agentServiceFetch(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.AGENT_SERVICE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("AGENT_SERVICE_URL is not configured");
  const headers = new Headers(init.headers);
  if (!headers.has("X-Vio-Trace-Id")) headers.set("X-Vio-Trace-Id", crypto.randomUUID());
  if (process.env.AGENT_SERVICE_REQUIRE_OIDC === "true") {
    const client = await new GoogleAuth().getIdTokenClient(process.env.AGENT_SERVICE_OIDC_AUDIENCE || baseUrl);
    const identityHeaders: any = await client.getRequestHeaders(baseUrl);
    const authorization = typeof identityHeaders.get === "function" ? identityHeaders.get("authorization") : identityHeaders.Authorization || identityHeaders.authorization;
    if (!authorization) throw new Error("Could not obtain an identity token for the agent service");
    headers.set("Authorization", authorization);
  }
  return fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers });
}

export function createAgentContextToken(userId: string, permissions: string[] = [], scope: AgentTokenScope = {}) {
  const secret = process.env.AGENT_SHARED_SECRET;
  if (!secret) throw new Error("AGENT_SHARED_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    permissions,
    ...(scope.runId ? { run_id: scope.runId } : {}),
    ...(scope.conversationId ? { conversation_id: scope.conversationId } : {}),
    ...(scope.traceId ? { trace_id: scope.traceId } : {}),
    exp: Math.floor(Date.now() / 1000) + 300,
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAgentContextToken(token: string | null) {
  const secret = process.env.AGENT_SHARED_SECRET;
  if (!secret || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!claims.sub || Number(claims.exp) < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: String(claims.sub),
      permissions: Array.isArray(claims.permissions) ? claims.permissions.map(String) : [],
      ...(claims.run_id ? { runId: String(claims.run_id) } : {}),
      ...(claims.conversation_id ? { conversationId: String(claims.conversation_id) } : {}),
      ...(claims.trace_id ? { traceId: String(claims.trace_id) } : {}),
    };
  } catch { return null; }
}

export async function enqueueHomeworkEvaluation(input: { userId: string; classroomId: string; submissionId: string; versionId: string }) {
  if (!process.env.AGENT_SERVICE_URL) return { queued: false, reason: "agent_service_not_configured" };
  const traceId = crypto.randomUUID();
  const token = createAgentContextToken(input.userId, ["homework:evaluate"], { traceId });
  const response = await agentServiceFetch("/v1/evaluations/homework", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId },
    body: JSON.stringify({ ...input, async_mode: false }),
    signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) throw new Error(`Inline evaluation failed (${response.status})`);
  return { queued: true, mode: "inline" as const };
}

export async function enqueueFileIngestion(input: { userId: string; documentId: string }) {
  // File extraction and embedding run in the request that accepted the upload.
  // Keeping this return shape preserves the existing upload workflow.
  void input;
  return { queued: false, reason: "inline_execution" as const };
}
