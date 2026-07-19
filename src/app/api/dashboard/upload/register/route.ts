import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedServices } from "@/lib/appwrite-server";
import { dashboardItemService, userService, workspaceService } from "@/lib/tidb-service";
import { allowedClassroomTypes, createFileTranscriber, requireProductionIngestionQueue, validateAndScan } from "@/lib/classroom-files";
import { createPendingKnowledgeDocument, ingestStoredClassroomFile } from "@/lib/classroom-file-processing";
import { enqueueFileIngestion } from "@/lib/agent-client";
import { ApiError, apiErrorResponse } from "@/lib/request-auth";
import { executeQuery, executeSingle } from "@/lib/tidb";
import { getBucketForFileType } from "@/lib/appwrite";
import { createEmbeddings } from "@/lib/embedding-service";

const inputSchema = z.object({
  fileId: z.string().min(1).max(255),
  bucketId: z.string().min(1).max(255),
  displayName: z.string().trim().min(1).max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    requireProductionIngestionQueue();
    const input = inputSchema.parse(await request.json());
    const { storage, user } = await getAuthenticatedServices(request);
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) throw new ApiError(404, "User profile is not initialized", "USER_NOT_FOUND");
    const metadata = await storage.getFile(input.bucketId, input.fileId);
    const mimeType = metadata.mimeType || "application/octet-stream";
    if (input.bucketId !== getBucketForFileType(mimeType)) throw new ApiError(400, "File bucket does not match its type", "FILE_BUCKET_INVALID");
    if (!allowedClassroomTypes.has(mimeType)) throw new ApiError(400, "This file type is not supported", "FILE_TYPE_UNSUPPORTED");
    if (Number(metadata.sizeOriginal) > 20 * 1024 * 1024) throw new ApiError(400, "Files are limited to 20 MB", "FILE_TOO_LARGE");
    const workspaces = await workspaceService.getByUserId(dbUser.id);
    const workspace = workspaces?.[0] || await workspaceService.create({ name: "Default Workspace", description: "Default workspace for user files", userId: dbUser.id, isDefault: true });
    const fileName = input.displayName || metadata.name;
    const fileUrl = storage.getFileView(input.bucketId, input.fileId).toString();
    const item = await dashboardItemService.create({
      title: fileName,
      displayName: fileName,
      description: `Uploaded file: ${fileName}`,
      content: "File processing is in progress.",
      fileType: mimeType,
      fileSize: Number(metadata.sizeOriginal),
      fileUrl,
      appwriteFileId: input.fileId,
      appwriteBucketId: input.bucketId,
      workspaceId: workspace.id,
      createdBy: dbUser.id,
    });
    const documentId = await createPendingKnowledgeDocument(dbUser.id, { name: metadata.name, type: mimeType }, { type: "workspace", id: workspace.id }, item.id);
    const queued = await enqueueFileIngestion({ userId: dbUser.id, documentId });
    if (!queued.queued) {
      const buffer = Buffer.from(await storage.getFileDownload(input.bucketId, input.fileId));
      await validateAndScan({ name: metadata.name, type: mimeType }, buffer);
      await ingestStoredClassroomFile(documentId, { name: metadata.name, type: mimeType }, buffer, {
        transcribe: createFileTranscriber(dbUser.id),
        embed: (texts) => createEmbeddings(dbUser.id, texts, "RETRIEVAL_DOCUMENT"),
        throwOnFailure: true,
      });
      const chunks = await executeQuery<any>(`SELECT content FROM knowledge_chunks WHERE document_id=? ORDER BY chunk_index`, [documentId]);
      await executeSingle(`UPDATE dashboard_items SET content=? WHERE id=? AND created_by=?`, [chunks.map((chunk) => chunk.content).join("\n\n"), item.id, dbUser.id]);
    }
    return NextResponse.json({ success: true, item: { ...item, processingStatus: queued.queued ? "pending" : "ready" } }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
