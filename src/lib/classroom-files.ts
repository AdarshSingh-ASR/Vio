import crypto from "crypto";
import { getAuthenticatedServices } from "@/lib/appwrite-server";
import { getBucketForFileType } from "@/lib/appwrite";
import { executeSingle } from "@/lib/tidb";
import { ApiError } from "@/lib/request-auth";
import { createEmbeddings } from "@/lib/embedding-service";
import { createPendingKnowledgeDocument, ingestStoredClassroomFile } from "@/lib/classroom-file-processing";
import { agentServiceFetch, createAgentContextToken, enqueueFileIngestion } from "@/lib/agent-client";

export const allowedClassroomTypes = new Set([
  "application/pdf", "text/plain", "text/csv", "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/webm",
  "video/mp4", "video/webm", "video/quicktime",
]);

const detectedAliases: Record<string, Set<string>> = {
  "application/zip": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
};

export async function validateAndScan(file: { name: string; type: string }, buffer: Buffer) {
  const { fileTypeFromBuffer } = await import("file-type");
  const detected = await fileTypeFromBuffer(buffer.subarray(0, Math.min(buffer.length, 8192)));
  if (detected && detected.mime !== file.type && !detectedAliases[detected.mime]?.has(file.type)) {
    throw new ApiError(400, `${file.name} content does not match its declared file type`, "ATTACHMENT_TYPE_MISMATCH");
  }

  const scanUrl = process.env.MALWARE_SCAN_URL;
  if (!scanUrl) {
    if (process.env.REQUIRE_MALWARE_SCAN === "true") throw new ApiError(503, "File scanning is temporarily unavailable", "MALWARE_SCANNER_REQUIRED");
    return;
  }
  const response = await fetch(scanUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      ...(process.env.MALWARE_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.MALWARE_SCAN_TOKEN}` } : {}),
    },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new ApiError(503, "File scanning failed; please retry", "MALWARE_SCAN_FAILED");
  const result = await response.json().catch(() => ({}));
  if (result.clean !== true) throw new ApiError(400, `${file.name} was rejected by the security scanner`, "MALWARE_DETECTED");
}

export function createFileTranscriber(userId: string) {
  return async (media: Buffer, descriptor: { name: string; type: string }) => {
    if (!process.env.AGENT_SERVICE_URL) throw new Error("Media transcription service is not configured");
    const token = createAgentContextToken(userId, ["files:ingest"]);
    const formData = new FormData();
    formData.set("mime_type", descriptor.type);
    formData.set("upload", new Blob([new Uint8Array(media)], { type: descriptor.type }), descriptor.name);
    const response = await agentServiceFetch("/v1/files/transcribe", { method: "POST", headers: { "X-Vio-Agent-Token": token }, body: formData, signal: AbortSignal.timeout(240_000) });
    if (!response.ok) throw new Error(`Media transcription failed (${response.status})`);
    return String((await response.json()).text || "");
  };
}

export function requireProductionIngestionQueue() {
  // Render's single-service deployment processes uploads inline. Keep this
  // guard as a compatibility no-op for callers shared with queued deployments.
}

export async function uploadClassroomFiles(request: Request, files: File[], target: { type: "assignment" | "submission"; id: string; userId: string }) {
  if (!files.length) return [];
  requireProductionIngestionQueue();
  const { storage } = await getAuthenticatedServices(request);
  const uploaded: any[] = [];
  for (const file of files.slice(0, 10)) {
    if (!allowedClassroomTypes.has(file.type)) throw new ApiError(400, `${file.name} is not a supported attachment type`, "ATTACHMENT_TYPE_UNSUPPORTED");
    if (file.size > 20 * 1024 * 1024) throw new ApiError(400, `${file.name} exceeds the 20 MB limit`, "ATTACHMENT_TOO_LARGE");
    const buffer = Buffer.from(await file.arrayBuffer());
    await validateAndScan(file, buffer);
    const bucketId = getBucketForFileType(file.type);
    const fileId = crypto.randomUUID();
    await storage.createFile(bucketId, fileId, file);
    const attachmentId = crypto.randomUUID();
    if (target.type === "assignment") {
      await executeSingle(`INSERT INTO assignment_attachments (id, assignment_id, appwrite_file_id, bucket_id, file_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [attachmentId, target.id, fileId, bucketId, file.name, file.type, file.size]);
    } else {
      await executeSingle(`INSERT INTO submission_attachments (id, submission_version_id, appwrite_file_id, bucket_id, file_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [attachmentId, target.id, fileId, bucketId, file.name, file.type, file.size]);
    }
    const knowledgeDocumentId = await createPendingKnowledgeDocument(target.userId, file, target, attachmentId);
    const queue = await enqueueFileIngestion({ userId: target.userId, documentId: knowledgeDocumentId });
    if (!queue.queued) {
      await ingestStoredClassroomFile(knowledgeDocumentId, file, buffer, {
        transcribe: createFileTranscriber(target.userId),
        embed: (texts) => createEmbeddings(target.userId, texts, "RETRIEVAL_DOCUMENT"),
        throwOnFailure: true,
      });
    }
    uploaded.push({ id: attachmentId, fileName: file.name, mimeType: file.type, sizeBytes: file.size, knowledgeDocumentId, processingStatus: queue.queued ? "pending" : "ready" });
  }
  return uploaded;
}

export async function registerStoredClassroomFile(
  request: Request,
  input: { fileId: string; bucketId: string },
  target: { type: "assignment" | "submission"; id: string; userId: string }
) {
  requireProductionIngestionQueue();
  const { storage } = await getAuthenticatedServices(request);
  const metadata = await storage.getFile(input.bucketId, input.fileId);
  const file = { name: metadata.name, type: metadata.mimeType || "application/octet-stream" };
  if (!allowedClassroomTypes.has(file.type)) throw new ApiError(400, `${file.name} is not a supported attachment type`, "ATTACHMENT_TYPE_UNSUPPORTED");
  if (Number(metadata.sizeOriginal) > 20 * 1024 * 1024) throw new ApiError(400, `${file.name} exceeds the 20 MB limit`, "ATTACHMENT_TOO_LARGE");
  if (input.bucketId !== getBucketForFileType(file.type)) throw new ApiError(400, "Attachment bucket does not match its file type", "ATTACHMENT_BUCKET_INVALID");

  const attachmentId = crypto.randomUUID();
  if (target.type === "assignment") {
    await executeSingle(`INSERT INTO assignment_attachments (id, assignment_id, appwrite_file_id, bucket_id, file_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [attachmentId, target.id, input.fileId, input.bucketId, file.name, file.type, metadata.sizeOriginal]);
  } else {
    await executeSingle(`INSERT INTO submission_attachments (id, submission_version_id, appwrite_file_id, bucket_id, file_name, mime_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)`, [attachmentId, target.id, input.fileId, input.bucketId, file.name, file.type, metadata.sizeOriginal]);
  }
  const documentId = await createPendingKnowledgeDocument(target.userId, file, target, attachmentId);
  const queue = await enqueueFileIngestion({ userId: target.userId, documentId });
  if (!queue.queued) {
    const download = Buffer.from(await storage.getFileDownload(input.bucketId, input.fileId));
    await validateAndScan(file, download);
    await ingestStoredClassroomFile(documentId, file, download, {
      transcribe: createFileTranscriber(target.userId),
      embed: (texts) => createEmbeddings(target.userId, texts, "RETRIEVAL_DOCUMENT"),
      throwOnFailure: true,
    });
  }
  return { id: attachmentId, fileName: file.name, mimeType: file.type, sizeBytes: Number(metadata.sizeOriginal), knowledgeDocumentId: documentId, processingStatus: queue.queued ? "pending" : "ready" };
}
