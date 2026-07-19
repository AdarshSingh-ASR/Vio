import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiErrorResponse, ApiError, requireDbUser } from "@/lib/request-auth";
import { executeQuery } from "@/lib/tidb";

export async function GET(request: NextRequest, props: { params: Promise<{ runId: string }> }) {
  const { runId } = await props.params;
  try {
    const user = await requireDbUser(request);
    const after = z.coerce.number().int().min(0).catch(0).parse(request.nextUrl.searchParams.get("after") || 0);
    const runs = await executeQuery<any>(`SELECT status, error_code FROM agent_runs WHERE id=? AND user_id=?`, [runId, user.id]);
    if (!runs[0]) throw new ApiError(404, "Agent run not found", "AGENT_RUN_NOT_FOUND");
    const events = await executeQuery<any>(`SELECT id, event_type, payload, created_at FROM agent_events WHERE run_id=? AND id>? ORDER BY id LIMIT 200`, [runId, after]);
    return NextResponse.json({ runId, status: runs[0].status, errorCode: runs[0].error_code, events: events.map((event) => ({ ...event, payload: typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload })), nextAfter: events.at(-1)?.id || after });
  } catch (error) { return apiErrorResponse(error); }
}
