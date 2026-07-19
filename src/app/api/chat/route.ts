import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { agentServiceFetch, createAgentContextToken } from "@/lib/agent-client";
import { conversationService } from "@/lib/conversation-service";
import { decryptSecret } from "@/lib/credential-vault";
import { executeQuery, executeSingle } from "@/lib/tidb";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { retrieveMemoriesForUser } from "@/lib/mem0";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  message: z.string().trim().min(1).max(100000).optional(),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })).optional(),
  conversationId: z.string().optional(),
  chatId: z.string().optional(),
  contextItemIds: z.array(z.string()).optional(),
  contextItems: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    await enforceRateLimit(user.id, "chat", 30, 60);
    const input = requestSchema.parse(await request.json());
    const message = input.message || [...(input.messages || [])].reverse().find((item) => item.role === "user")?.content;
    if (!message) return NextResponse.json({ error: "A user message is required" }, { status: 400 });
    if (!process.env.AGENT_SHARED_SECRET) return NextResponse.json({ error: "The internal agent secret is not configured" }, { status: 503 });

    const conversationId = await conversationService.ensure(user.id, input.conversationId || input.chatId, message.slice(0, 80));
    await conversationService.addMessage({ conversationId, role: "user", content: message });
    const preferenceRows = await executeQuery<any>(`SELECT default_provider, allow_built_in_fallback FROM user_ai_preferences WHERE user_id = ?`, [user.id]);
    const providerMode = preferenceRows[0]?.default_provider || "built_in";
    const allowBuiltInFallback = Boolean(preferenceRows[0]?.allow_built_in_fallback);
    let openAIKey: string | undefined;
    if (providerMode === "openai_byok") {
      const credentials = await executeQuery<any>(`SELECT encrypted_value, key_version FROM ai_credentials WHERE user_id = ? AND provider = 'openai' AND status = 'active'`, [user.id]);
      if (!credentials[0]) return NextResponse.json({ error: "Your OpenAI API key is not connected" }, { status: 400 });
      openAIKey = await decryptSecret({ ciphertext: credentials[0].encrypted_value, keyVersion: credentials[0].key_version });
    }

    const serviceUrl = process.env.AGENT_SERVICE_URL;
    if (!serviceUrl) return NextResponse.json({ error: "Vio Agent service is not configured", code: "AGENT_SERVICE_UNAVAILABLE" }, { status: 503 });
    const runId = crypto.randomUUID();
    const traceId = request.headers.get("X-Vio-Trace-Id")?.slice(0, 64) || crypto.randomUUID();
    const initialProvider = providerMode === "openai_byok" ? "openai" : "vertex";
    const initialModel = providerMode === "openai_byok" ? process.env.OPENAI_MODEL || "gpt-5.6" : process.env.VERTEX_MODEL || "gemini-2.5-flash";
    const selectedItemIds = (input.contextItemIds || input.contextItems || []).slice(0, 10);
    const curatedMemories = await retrieveMemoriesForUser(message, user.id, { limit: 8, minConfidence: 0.7 });
    await executeSingle(
      `INSERT INTO agent_runs (id, trace_id, conversation_id, user_id, status, provider, model, allow_built_in_fallback, context_item_ids)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?)`,
      [runId, traceId, conversationId, user.id, initialProvider, initialModel, allowBuiltInFallback, JSON.stringify(selectedItemIds)]
    );
    const token = createAgentContextToken(
      user.id,
      ["documents:read", "classrooms:read", "classrooms:manage", "teacher-reviews:publish", "memory:write", "learning:read", "research:read", "assignments:write", "assignments:publish"],
      { runId, conversationId, traceId }
    );
    const upstream = await agentServiceFetch("/v1/agent/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Vio-Agent-Token": token, "X-Vio-Trace-Id": traceId, ...(openAIKey ? { "X-OpenAI-Key": openAIKey } : {}) },
      body: JSON.stringify({ message, conversation_id: conversationId, run_id: runId, provider_mode: providerMode, allow_built_in_fallback: allowBuiltInFallback, context_item_ids: selectedItemIds, curated_memories: curatedMemories.map((memory) => memory.content) }),
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      console.error("Agent service rejected chat", { status: upstream.status });
      await executeSingle(`UPDATE agent_runs SET status='failed', error_code='AGENT_SERVICE_REJECTED', completed_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?`, [runId, user.id]);
      return NextResponse.json({ error: "The AI service is temporarily unavailable" }, { status: 503 });
    }

    const decoder = new TextDecoder();
    let assistantContent = "";
    let parseBuffer = "";
    let provider = initialProvider;
    let model = initialModel;
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            parseBuffer += decoder.decode(value, { stream: true });
            const events = parseBuffer.split("\n\n");
            parseBuffer = events.pop() || "";
            for (const event of events) {
              const line = event.split("\n").find((part) => part.startsWith("data:"));
              if (!line) continue;
              try {
                const data = JSON.parse(line.slice(5).trim());
                if (data.type === "message.delta") assistantContent += data.delta || "";
                if (data.type === "done") { if (data.provider && data.provider !== "unknown") provider = data.provider; model = data.model || model; }
              } catch { /* malformed upstream events are ignored but still forwarded */ }
            }
          }
          if (assistantContent) await conversationService.addMessage({ conversationId, role: "assistant", content: assistantContent, provider, model });
          controller.close();
        } catch (error) {
          console.error("Chat stream interrupted", error);
          if (assistantContent) await conversationService.addMessage({ conversationId, role: "assistant", content: assistantContent, provider, model, status: "failed" });
          await executeSingle(`UPDATE agent_runs SET status='failed', error_code='STREAM_INTERRUPTED', completed_at=UTC_TIMESTAMP() WHERE id=? AND user_id=?`, [runId, user.id]);
          controller.error(error);
        } finally { reader.releaseLock(); }
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Conversation-Id": conversationId, "X-Agent-Run-Id": runId, "X-Accel-Buffering": "no" } });
  } catch (error) { return apiErrorResponse(error); }
}

export async function GET() {
  return NextResponse.json({ status: process.env.AGENT_SERVICE_URL ? "configured" : "unconfigured", primary: "vertex", model: process.env.VERTEX_MODEL || "gemini-2.5-flash" });
}
