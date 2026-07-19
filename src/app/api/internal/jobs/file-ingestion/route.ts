import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAgentContextToken } from "@/lib/agent-client";
import { storage } from "@/lib/appwrite-server";
import { ingestStoredClassroomFile } from "@/lib/classroom-file-processing";
import { validateAndScan } from "@/lib/classroom-files";
import { executeQuery, executeSingle } from "@/lib/tidb";
import { ApiError } from "@/lib/request-auth";
import { agentServiceFetch } from "@/lib/agent-client";
import { createEmbeddings } from "@/lib/embedding-service";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({ documentId: z.string().uuid() });

export async function POST(request: NextRequest) {
  const context = verifyAgentContextToken(request.headers.get("X-Vio-Agent-Token"));
  if (!context || !context.permissions.includes("files:ingest")) {
    return NextResponse.json({ error: "Invalid ingestion job authorization" }, { status: 401 });
  }
  let jobDocumentId: string | null = null;
  let jobFileId: string | null = null;
  let jobBucketId: string | null = null;
  try {
    const { documentId } = requestSchema.parse(await request.json());
    jobDocumentId = documentId;
    const rows = await executeQuery<any>(
      `SELECT kd.id, kd.user_id, kd.file_name, kd.mime_type, kd.status, kd.scope_type, kd.source_item_id,
              COALESCE(aa.appwrite_file_id, sa.appwrite_file_id, di.appwrite_file_id) AS appwrite_file_id,
              COALESCE(aa.bucket_id, sa.bucket_id, di.appwrite_bucket_id) AS bucket_id
       FROM knowledge_documents kd
       LEFT JOIN assignment_attachments aa ON aa.id=kd.source_item_id AND kd.scope_type='assignment'
       LEFT JOIN submission_attachments sa ON sa.id=kd.source_item_id AND kd.scope_type='submission'
       LEFT JOIN dashboard_items di ON di.id=kd.source_item_id AND kd.scope_type='workspace'
       WHERE kd.id=? AND kd.user_id=? LIMIT 1`,
      [documentId, context.userId]
    );
    const document = rows[0];
    if (!document) return NextResponse.json({ error: "Knowledge document not found" }, { status: 404 });
    if (document.status === "ready") return NextResponse.json({ documentId, status: "ready", idempotent: true });
    if (!document.appwrite_file_id || !document.bucket_id) return NextResponse.json({ error: "Attachment storage metadata is missing" }, { status: 409 });
    jobFileId = document.appwrite_file_id;
    jobBucketId = document.bucket_id;

    const download = await storage.getFileDownload(document.bucket_id, document.appwrite_file_id);
    const buffer = Buffer.from(download);
    const descriptor = { name: document.file_name, type: document.mime_type || "application/octet-stream" };
    await validateAndScan(descriptor, buffer);
    const transcribe = async (buffer: Buffer, file: { name: string; type: string }) => {
      if (!process.env.AGENT_SERVICE_URL) throw new Error("Media transcription service is not configured");
      const formData = new FormData();
      formData.set("mime_type", file.type);
      formData.set("upload", new Blob([new Uint8Array(buffer)], { type: file.type }), file.name);
      const response = await agentServiceFetch("/v1/files/transcribe", {
        method: "POST",
        headers: { "X-Vio-Agent-Token": request.headers.get("X-Vio-Agent-Token")! },
        body: formData,
        signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`Media transcription failed (${response.status})`);
      return String((await response.json()).text || "");
    };
    await ingestStoredClassroomFile(
      documentId,
      descriptor,
      buffer,
      {
        transcribe,
        embed: (texts) => createEmbeddings(context.userId, texts, "RETRIEVAL_DOCUMENT", request.headers.get("X-Vio-Agent-Token")!),
        throwOnFailure: true,
      }
    );
    if (document.scope_type === "workspace") {
      const chunks = await executeQuery<any>(`SELECT content FROM knowledge_chunks WHERE document_id=? ORDER BY chunk_index`, [documentId]);
      await executeSingle(`UPDATE dashboard_items SET content=? WHERE id=? AND created_by=?`, [chunks.map((chunk) => chunk.content).join("\n\n"), document.source_item_id, context.userId]);
    }
    const updated = await executeQuery<any>(`SELECT status, error_message FROM knowledge_documents WHERE id=?`, [documentId]);
    return NextResponse.json({ documentId, status: updated[0]?.status, error: updated[0]?.error_message || undefined });
  } catch (error) {
    console.error("File ingestion job failed", error);
    if (jobDocumentId) await executeSingle(`UPDATE knowledge_documents SET status='failed', error_message=? WHERE id=? AND status!='ready'`, [error instanceof Error ? error.message.slice(0, 2000) : "File ingestion failed", jobDocumentId]);
    if (error instanceof ApiError && error.status === 400 && jobFileId && jobBucketId) {
      await storage.deleteFile(jobBucketId, jobFileId).catch(() => undefined);
      await executeSingle(`INSERT INTO audit_events (trace_id, actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, ?, 'file.quarantined', 'knowledge_document', ?, JSON_OBJECT('code', ?))`, [context.traceId || null, context.userId, jobDocumentId, error.code || "FILE_REJECTED"]);
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "File ingestion failed" }, { status: error instanceof ApiError ? error.status : 500 });
  }
}
