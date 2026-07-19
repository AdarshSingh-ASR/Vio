import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentServiceFetch, createAgentContextToken } from "@/lib/agent-client";
import { decryptSecret } from "@/lib/credential-vault";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { executeQuery } from "@/lib/tidb";

export async function POST(request: NextRequest, props: { params: Promise<{ runId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const { approved, note } = z.object({ approved: z.boolean(), note: z.string().trim().max(2000).optional() }).parse(await request.json());
    if (!process.env.AGENT_SERVICE_URL) return NextResponse.json({ error: "Agent service is not configured" }, { status: 503 });
    const runs = await executeQuery<any>(`SELECT conversation_id, provider, trace_id FROM agent_runs WHERE id=? AND user_id=? AND status='awaiting_approval'`, [params.runId, user.id]);
    if (!runs[0]) return NextResponse.json({ error: "This approval is not pending or does not belong to you" }, { status: 404 });
    let openAIKey: string | undefined;
    if (runs[0].provider === "openai") {
      const credentials = await executeQuery<any>(`SELECT encrypted_value, key_version FROM ai_credentials WHERE user_id=? AND provider='openai' AND status='active'`, [user.id]);
      if (!credentials[0]) return NextResponse.json({ error: "Your OpenAI credential is no longer available" }, { status: 409 });
      openAIKey = await decryptSecret({ ciphertext: credentials[0].encrypted_value, keyVersion: credentials[0].key_version });
    }
    const token = createAgentContextToken(user.id, ["documents:read", "classrooms:read", "classrooms:manage", "teacher-reviews:publish", "memory:write", "learning:read", "research:read", "assignments:write", "assignments:publish"], { runId: params.runId, conversationId: runs[0].conversation_id, traceId: runs[0].trace_id });
    const query = new URLSearchParams({ approved: String(approved), ...(note ? { note } : {}) });
    const response = await agentServiceFetch(`/v1/agent/runs/${encodeURIComponent(params.runId)}/continue?${query}`, {
      method: "POST",
      headers: { "X-Vio-Agent-Token": token, ...(runs[0].trace_id ? { "X-Vio-Trace-Id": runs[0].trace_id } : {}), ...(openAIKey ? { "X-OpenAI-Key": openAIKey } : {}) },
      signal: AbortSignal.timeout(60_000),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: data.detail || "Could not resume the agent run" }, { status: response.status });
    return NextResponse.json(data);
  } catch (error) { return apiErrorResponse(error); }
}
