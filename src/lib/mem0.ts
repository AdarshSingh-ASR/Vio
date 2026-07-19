import crypto from "crypto";
import { executeQuery, executeSingle, withTransaction } from "@/lib/tidb";

type MemoryMessage = { role?: string; content?: string | { type?: string; text?: string }[] };

async function resolveUserId(userId: string) {
  const rows = await executeQuery<any>(`SELECT id FROM users WHERE id = ? OR appwrite_user_id = ? LIMIT 1`, [userId, userId]);
  return rows[0]?.id as string | undefined;
}

function textFromMessages(messages: MemoryMessage[]) {
  return messages.flatMap((message) => typeof message.content === "string" ? [message.content] : (message.content || []).map((part) => part.text || "")).join("\n").trim();
}

export const storeMemory = async (userId: string, messages: MemoryMessage[], metadata?: any) => {
  try {
    const resolvedUserId = await resolveUserId(userId);
    const content = textFromMessages(messages);
    if (!resolvedUserId || !content) return null;
    if (/(?:api|secret|access)[ _-]?key|password|bearer\s+[a-z0-9._-]+|private grading|teacher grade|final marks?/i.test(content)) {
      throw new Error("Credentials and sensitive grading data cannot be stored as conversational memory");
    }
    const scopeType = ["workspace", "classroom", "conversation"].includes(metadata?.scopeType) ? metadata.scopeType : "user";
    const memoryId = crypto.randomUUID();
    const memoryKey = String(metadata?.memoryKey || crypto.createHash("sha256").update(content.toLowerCase().trim()).digest("hex")).slice(0, 255);
    const confidence = Math.min(1, Math.max(0, Number(metadata?.confidence ?? 0.9)));
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO user_memories (id, user_id, scope_type, scope_id, memory_key, content, source, sensitivity, confidence, expires_at, source_message_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?, ?)`,
        [memoryId, resolvedUserId, scopeType, metadata?.scopeId || null, memoryKey, content.slice(0, 10000), metadata?.source || "user_explicit", confidence, metadata?.expiresAt ? new Date(metadata.expiresAt) : null, metadata?.sourceMessageId || null]
      );
      await connection.execute(
        `UPDATE user_memories SET superseded_by=? WHERE user_id=? AND scope_type=? AND memory_key=? AND id<>? AND superseded_by IS NULL
         AND ((scope_id IS NULL AND ? IS NULL) OR scope_id=?)`,
        [memoryId, resolvedUserId, scopeType, memoryKey, memoryId, metadata?.scopeId || null, metadata?.scopeId || null]
      );
    });
    return { success: true, id: memoryId };
  } catch (error) {
    console.error("Persistent memory store failed", error);
    if (metadata?.strict) throw error;
    return null;
  }
};

export const retrieveMemoriesForUser = async (prompt: string | any[], userId: string, options?: any) => {
  try {
    const resolvedUserId = await resolveUserId(userId);
    if (!resolvedUserId) return [];
    const query = typeof prompt === "string" ? prompt : textFromMessages(prompt);
    const terms = query.toLowerCase().split(/\W+/).filter((term) => term.length > 3).slice(0, 5);
    const conditions = terms.length ? terms.map(() => "LOWER(content) LIKE ?").join(" OR ") : "1=1";
    const scopeType = options?.scopeType && ["workspace", "classroom", "conversation"].includes(options.scopeType) ? options.scopeType : "user";
    const scopeId = options?.scopeId || null;
    const rows = await executeQuery<any>(
      `SELECT id, memory_key, content, source, scope_type, scope_id, confidence, created_at, updated_at
       FROM user_memories WHERE user_id = ? AND superseded_by IS NULL AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
       AND sensitivity='normal' AND confidence >= ?
       AND (scope_type='user' OR (scope_type=? AND scope_id=?))
       AND (${conditions}) ORDER BY confidence DESC, updated_at DESC LIMIT ?`,
      [resolvedUserId, Number(options?.minConfidence ?? 0.6), scopeType, scopeId, ...terms.map((term) => `%${term}%`), Math.min(Number(options?.limit || 8), 50)]
    );
    return rows;
  } catch (error) {
    console.error("Persistent memory retrieval failed", error);
    return [];
  }
};

export const getMemoriesArray = retrieveMemoriesForUser;

export async function deleteMemory(memoryId: string, userId: string) {
  const resolvedUserId = await resolveUserId(userId);
  if (!resolvedUserId) return false;
  await executeSingle(`DELETE FROM user_memories WHERE id = ? AND user_id = ?`, [memoryId, resolvedUserId]);
  return true;
}
