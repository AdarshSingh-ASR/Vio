import crypto from "crypto";
import { CloudTasksClient, protos } from "@google-cloud/tasks";
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
  const endpoint = process.env.AGENT_SERVICE_URL ? `${process.env.AGENT_SERVICE_URL}/v1/evaluations/homework` : null;
  if (!endpoint) return { queued: false, reason: "agent_service_not_configured" };
  const traceId = crypto.randomUUID();
  const token = createAgentContextToken(input.userId, ["homework:evaluate"], { traceId });
  const queueProject = process.env.CLOUD_TASKS_PROJECT;
  const queueLocation = process.env.CLOUD_TASKS_LOCATION;
  const queueName = process.env.CLOUD_TASKS_QUEUE;
  if (queueProject && queueLocation && queueName) {
    const client = new CloudTasksClient();
    const parent = client.queuePath(queueProject, queueLocation, queueName);
    const taskId = `homework-${input.versionId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const request: protos.google.cloud.tasks.v2.ICreateTaskRequest = {
      parent,
      task: {
        name: `${parent}/tasks/${taskId}`,
        dispatchDeadline: { seconds: 900 },
        httpRequest: {
          url: endpoint,
          httpMethod: "POST",
          headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId },
          body: Buffer.from(JSON.stringify({ ...input, async_mode: false })).toString("base64"),
          ...(process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL ? { oidcToken: { serviceAccountEmail: process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL, audience: process.env.AGENT_SERVICE_URL } } : {}),
        },
      },
    };
    try { await client.createTask(request); } catch (error: any) { if (error?.code !== 6) throw error; }
    return { queued: true };
  }
  const response = await agentServiceFetch("/v1/evaluations/homework", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId },
    body: JSON.stringify({ ...input, async_mode: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Evaluation queue rejected the request (${response.status})`);
  return { queued: true };
}

export async function enqueueFileIngestion(input: { userId: string; documentId: string }) {
  const callbackBase = process.env.VIO_JOB_CALLBACK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  const queueProject = process.env.CLOUD_TASKS_PROJECT;
  const queueLocation = process.env.CLOUD_TASKS_LOCATION;
  const queueName = process.env.CLOUD_TASKS_INGESTION_QUEUE || process.env.CLOUD_TASKS_QUEUE;
  if (!callbackBase || !queueProject || !queueLocation || !queueName) {
    return { queued: false, reason: "cloud_tasks_not_configured" as const };
  }
  const traceId = crypto.randomUUID();
  const token = createAgentContextToken(input.userId, ["files:ingest"], { traceId });
  const client = new CloudTasksClient();
  const parent = client.queuePath(queueProject, queueLocation, queueName);
  const taskId = `ingest-${input.documentId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const endpoint = `${callbackBase.replace(/\/$/, "")}/api/internal/jobs/file-ingestion`;
  const request: protos.google.cloud.tasks.v2.ICreateTaskRequest = {
    parent,
    task: {
      name: `${parent}/tasks/${taskId}`,
      dispatchDeadline: { seconds: 900 },
      httpRequest: {
        url: endpoint,
        httpMethod: "POST",
        headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId },
        body: Buffer.from(JSON.stringify({ documentId: input.documentId })),
        ...(process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL ? {
          oidcToken: { serviceAccountEmail: process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL, audience: callbackBase },
        } : {}),
      },
    },
  };
  try {
    await client.createTask(request);
  } catch (error: any) {
    if (error?.code !== 6) throw error; // ALREADY_EXISTS makes the operation idempotent.
  }
  return { queued: true };
}
