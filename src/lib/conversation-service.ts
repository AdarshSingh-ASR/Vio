import crypto from "crypto";
import { executeQuery, executeSingle } from "@/lib/tidb";

const uuidFromSeed = (seed: string) => {
  const hash = crypto.createHash("sha256").update(seed).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

export const conversationService = {
  async ensure(userId: string, requestedId?: string, title?: string) {
    const conversationId = requestedId && /^[0-9a-f-]{36}$/i.test(requestedId) ? requestedId : uuidFromSeed(`${userId}:${requestedId || "default"}`);
    await executeSingle(
      `INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [conversationId, userId, title?.slice(0, 255) || "Vio Assistant"]
    );
    return conversationId;
  },
  async addMessage(input: { conversationId: string; role: "system" | "user" | "assistant" | "tool"; content: string; provider?: string; model?: string; status?: "streaming" | "completed" | "failed"; parts?: unknown }) {
    const messageId = crypto.randomUUID();
    await executeSingle(
      `INSERT INTO conversation_messages (id, conversation_id, role, content, parts, provider, model, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [messageId, input.conversationId, input.role, input.content, input.parts ? JSON.stringify(input.parts) : null, input.provider || null, input.model || null, input.status || "completed"]
    );
    return messageId;
  },
  async history(conversationId: string, userId: string, limit = 50, before?: string) {
    const [beforeDate, beforeId] = before?.split("|") || [];
    const rows = await executeQuery<any>(
      `SELECT m.id, m.role, m.content, m.parts, m.provider, m.model, m.status, m.created_at
       FROM conversation_messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE m.conversation_id = ? AND c.user_id = ? ${before ? "AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))" : ""}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      [conversationId, userId, ...(before ? [new Date(beforeDate), new Date(beforeDate), beforeId || ""] : []), Math.min(Math.max(limit, 1), 100)]
    );
    return rows.reverse();
  },
  async clear(conversationId: string, userId: string) {
    await executeSingle(`DELETE m FROM conversation_messages m JOIN conversations c ON c.id = m.conversation_id WHERE m.conversation_id = ? AND c.user_id = ?`, [conversationId, userId]);
  },
};
