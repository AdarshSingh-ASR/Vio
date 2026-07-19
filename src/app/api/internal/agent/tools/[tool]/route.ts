import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAgentContextToken } from "@/lib/agent-client";
import { classroomService } from "@/lib/classroom-service";
import { executeQuery } from "@/lib/tidb";
import { withToolAudit } from "@/lib/tool-audit";
import { storeMemory } from "@/lib/mem0";
import { knowledgeStore } from "@/lib/knowledge-store";

export async function POST(request: NextRequest, props: { params: Promise<{ tool: string }> }) {
  const params = await props.params;
  const context = verifyAgentContextToken(request.headers.get("X-Vio-Agent-Token"));
  if (!context) return NextResponse.json({ error: "Invalid internal tool token" }, { status: 401 });
  const input = await request.json().catch(() => ({}));
  try {
    switch (params.tool) {
      case "search-documents": {
        const values = z.object({ query: z.string().trim().min(2).max(500), limit: z.number().int().min(1).max(10) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: values, requiredPermission: "documents:read", execute: async () => {
          const terms = `%${values.query.replace(/[%_]/g, "")} %`.replace(" %", "%");
          const rows = await executeQuery<any>(
            `SELECT id, display_name AS title, LEFT(content, 4000) AS excerpt, file_type, file_url
             FROM dashboard_items WHERE created_by = ? AND (title LIKE ? OR content LIKE ?)
             ORDER BY updated_at DESC LIMIT ?`,
            [context.userId, terms, terms, values.limit]
          );
          const chunks = await knowledgeStore.searchOwned({ userId: context.userId, query: values.query, limit: values.limit });
          return { results: [
            ...rows.map((row, index) => ({ ...row, citation: `[D${index + 1}]`, sourceType: "workspace_item" })),
            ...chunks.map((chunk) => ({ id: chunk.chunkId, title: chunk.title, excerpt: chunk.content, locator: chunk.locator, score: chunk.score, citation: chunk.citation, sourceType: "knowledge_chunk" })),
          ].slice(0, values.limit) };
        }});
        return NextResponse.json(result);
      }
      case "get-selected-documents": {
        const { itemIds } = z.object({ itemIds: z.array(z.string().min(1).max(255)).min(1).max(10) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: { itemIds }, requiredPermission: "documents:read", execute: async () => {
          const placeholders = itemIds.map(() => "?").join(",");
          const rows = await executeQuery<any>(
            `SELECT id, display_name AS title, LEFT(content, 12000) AS excerpt, file_type, file_url
             FROM dashboard_items WHERE created_by = ? AND id IN (${placeholders})`,
            [context.userId, ...itemIds]
          );
          const byId = new Map(rows.map((row) => [String(row.id), row]));
          const ordered = itemIds.map((itemId) => byId.get(itemId)).filter(Boolean);
          return { results: ordered.map((row: any, index) => ({ ...row, citation: `[F${index + 1}]` })) };
        }});
        return NextResponse.json(result);
      }
      case "list-classrooms": {
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: {}, requiredPermission: "classrooms:read", execute: async () => ({ classrooms: await classroomService.listForUser(context.userId) }) });
        return NextResponse.json(result);
      }
      case "get-classroom": {
        const { classroomId } = z.object({ classroomId: z.string().uuid() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: { classroomId }, requiredPermission: "classrooms:read", execute: async () => ({ classroom: await classroomService.get(classroomId, context.userId) }) });
        return NextResponse.json(result);
      }
      case "publish-teacher-review": {
        const value = z.object({ classroomId: z.string().uuid(), submissionId: z.string().uuid(), marks: z.number().min(0), remarks: z.string().max(20000), improvements: z.string().max(20000).optional(), overrideReason: z.string().max(4000).optional() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "teacher-reviews:publish", execute: async () => classroomService.review(value.classroomId, value.submissionId, context.userId, { ...value, publish: true }) });
        return NextResponse.json(result);
      }
      case "remember-memory": {
        const value = z.object({ key: z.string().trim().min(2).max(255), content: z.string().trim().min(2).max(2000) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "write", arguments: value, requiredPermission: "memory:write", execute: async () => {
          const memory = await storeMemory(context.userId, [{ role: "user", content: value.content }], { memoryKey: value.key, source: "user_explicit", confidence: 1, strict: true });
          return { stored: Boolean(memory), memoryId: memory?.id };
        }});
        return NextResponse.json(result);
      }
      case "list-learning-paths": {
        const value = z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: value, requiredPermission: "learning:read", execute: async () => ({ paths: await executeQuery<any>(`SELECT id, title, description, subject_area, difficulty_level, status, progress_percentage, updated_at FROM learning_paths WHERE user_id=? ORDER BY updated_at DESC LIMIT ?`, [context.userId, value.limit]) }) });
        return NextResponse.json(result);
      }
      case "get-learning-path": {
        const value = z.object({ pathId: z.string().min(1).max(255) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: value, requiredPermission: "learning:read", execute: async () => {
          const paths = await executeQuery<any>(`SELECT * FROM learning_paths WHERE id=? AND user_id=?`, [value.pathId, context.userId]);
          if (!paths[0]) throw new Error("Learning path not found");
          const steps = await executeQuery<any>(`SELECT id, step_order, step_type, title, description, is_completed, completed_at FROM learning_steps WHERE learning_path_id=? ORDER BY step_order`, [value.pathId]);
          return { path: { ...paths[0], steps } };
        }});
        return NextResponse.json(result);
      }
      case "list-study-sessions": {
        const value = z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: value, requiredPermission: "learning:read", execute: async () => ({ sessions: await executeQuery<any>(`SELECT id, title, session_type, status, start_time, end_time, performance_metrics, updated_at FROM study_sessions WHERE user_id=? ORDER BY updated_at DESC LIMIT ?`, [context.userId, value.limit]) }) });
        return NextResponse.json(result);
      }
      case "list-research": {
        const value = z.object({ limit: z.number().int().min(1).max(20).default(10) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: value, requiredPermission: "research:read", execute: async () => ({ research: await executeQuery<any>(`SELECT id, query_text, query_type, summary, confidence_score, created_at FROM research_queries WHERE user_id=? ORDER BY created_at DESC LIMIT ?`, [context.userId, value.limit]) }) });
        return NextResponse.json(result);
      }
      case "list-assignment-submissions": {
        const value = z.object({ classroomId: z.string().uuid(), assignmentId: z.string().uuid() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "read", arguments: value, requiredPermission: "classrooms:read", execute: async () => ({ submissions: await classroomService.listSubmissions(value.classroomId, value.assignmentId, context.userId) }) });
        return NextResponse.json(result);
      }
      case "create-draft-assignment": {
        const value = z.object({ classroomId: z.string().uuid(), title: z.string().trim().min(2).max(255), instructions: z.string().trim().min(3).max(50000), dueAt: z.string().datetime(), maxMarks: z.number().positive().max(10000).default(100), lessonNumber: z.string().max(50).nullish(), chapterNumber: z.string().max(50).nullish(), chapterName: z.string().max(255).nullish() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "write", arguments: value, requiredPermission: "assignments:write", execute: async () => classroomService.createAssignment(value.classroomId, context.userId, { ...value, status: "draft", allowLate: false, allowResubmission: true }) });
        return NextResponse.json(result);
      }
      case "publish-assignment": {
        const value = z.object({ classroomId: z.string().uuid(), assignmentId: z.string().uuid(), confirmAfterSubmissions: z.boolean().default(false) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "assignments:publish", execute: async () => classroomService.updateAssignment(value.classroomId, value.assignmentId, context.userId, { status: "published", confirmAfterSubmissions: value.confirmAfterSubmissions }) });
        return NextResponse.json(result);
      }
      case "close-assignment": {
        const value = z.object({ classroomId: z.string().uuid(), assignmentId: z.string().uuid(), confirmAfterSubmissions: z.boolean().default(false) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "assignments:publish", execute: async () => classroomService.updateAssignment(value.classroomId, value.assignmentId, context.userId, { status: "closed", confirmAfterSubmissions: value.confirmAfterSubmissions }) });
        return NextResponse.json(result);
      }
      case "revoke-classroom-invite": {
        const value = z.object({ classroomId: z.string().uuid(), inviteId: z.string().uuid() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "classrooms:manage", execute: async () => classroomService.revokeInvite(value.classroomId, value.inviteId, context.userId) });
        return NextResponse.json(result);
      }
      case "remove-classroom-member": {
        const value = z.object({ classroomId: z.string().uuid(), memberUserId: z.string().min(1).max(255) }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "classrooms:manage", execute: async () => classroomService.removeMember(value.classroomId, value.memberUserId, context.userId) });
        return NextResponse.json(result);
      }
      case "archive-classroom": {
        const value = z.object({ classroomId: z.string().uuid() }).parse(input);
        const result = await withToolAudit({ context, toolId: params.tool, risk: "sensitive", arguments: value, requiredPermission: "classrooms:manage", execute: async () => classroomService.archive(value.classroomId, context.userId) });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
    }
  } catch (error) {
    console.error("Agent tool failed", { tool: params.tool, error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Tool failed" }, { status: 400 });
  }
}
