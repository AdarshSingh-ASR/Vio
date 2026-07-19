import crypto from "crypto";
import { ApiError } from "@/lib/request-auth";
import { executeQuery, executeSingle } from "@/lib/tidb";

type AgentToolContext = {
  userId: string;
  permissions: string[];
  runId?: string;
  traceId?: string;
};

function resultSummary(result: unknown) {
  if (Array.isArray(result)) return { type: "array", count: result.length };
  if (result && typeof result === "object") {
    const value = result as Record<string, unknown>;
    return {
      type: "object",
      keys: Object.keys(value).slice(0, 20),
      ...("results" in value && Array.isArray(value.results) ? { count: value.results.length } : {}),
    };
  }
  return { type: typeof result };
}

export function canonicalizeToolArguments(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeToolArguments).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized = Object.fromEntries(Object.entries(record).map(([key, nested]) => [key.replace(/_([a-z])/g, (_, character: string) => character.toUpperCase()), nested]));
    return `{${Object.keys(normalized).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeToolArguments(normalized[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function withToolAudit<T>(input: {
  context: AgentToolContext;
  toolId: string;
  risk: "read" | "write" | "sensitive";
  arguments: unknown;
  requiredPermission: string;
  execute: () => Promise<T>;
}) {
  const { context, risk, requiredPermission } = input;
  if (!context.runId) throw new ApiError(401, "Agent run context is missing", "AGENT_RUN_REQUIRED");
  if (!context.permissions.includes(requiredPermission)) throw new ApiError(403, "The agent is not permitted to use this tool", "TOOL_PERMISSION_DENIED");
  const normalizedToolId = input.toolId.replace(/-/g, "_");
  let executionId = crypto.randomUUID();

  if (risk === "sensitive") {
    const pending = await executeQuery<any>(
      `SELECT te.id, te.arguments_json FROM tool_executions te JOIN agent_runs ar ON ar.id=te.run_id
       WHERE te.run_id=? AND ar.user_id=? AND te.tool_id=? AND te.status='approved'
       ORDER BY te.id LIMIT 1`,
      [context.runId, context.userId, normalizedToolId]
    );
    if (!pending[0]) throw new ApiError(409, "This sensitive tool call has not been approved", "TOOL_APPROVAL_REQUIRED");
    const approvedArguments = typeof pending[0].arguments_json === "string" ? JSON.parse(pending[0].arguments_json) : pending[0].arguments_json;
    if (canonicalizeToolArguments(approvedArguments) !== canonicalizeToolArguments(input.arguments)) throw new ApiError(409, "The sensitive tool arguments differ from the approved action", "TOOL_APPROVAL_ARGUMENT_MISMATCH");
    executionId = pending[0].id;
    const claimed = await executeSingle(
      `UPDATE tool_executions SET trace_id=?, status='running', started_at=UTC_TIMESTAMP() WHERE id=? AND run_id=? AND status='approved'`,
      [context.traceId || null, executionId, context.runId]
    );
    if (claimed.affectedRows !== 1) throw new ApiError(409, "This approved tool call was already consumed", "TOOL_REPLAY_BLOCKED");
  } else {
    await executeSingle(
      `INSERT INTO tool_executions (id, trace_id, run_id, tool_id, risk_level, arguments_json, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?, 'running', UTC_TIMESTAMP())`,
      [executionId, context.traceId || null, context.runId, normalizedToolId, risk, JSON.stringify(input.arguments)]
    );
  }

  try {
    const result = await input.execute();
    await executeSingle(
      `UPDATE tool_executions SET result_json=?, status='completed', completed_at=UTC_TIMESTAMP() WHERE id=?`,
      [JSON.stringify({ ok: true, ...resultSummary(result) }), executionId]
    );
    return result;
  } catch (error) {
    await executeSingle(
      `UPDATE tool_executions SET result_json=?, status='failed', error_code=?, completed_at=UTC_TIMESTAMP() WHERE id=?`,
      [JSON.stringify({ ok: false }), error instanceof Error ? error.name.slice(0, 100) : "TOOL_ERROR", executionId]
    );
    throw error;
  }
}
