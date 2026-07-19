import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/appwrite-server";
import { getMembership } from "@/lib/classroom-service";
import { executeQuery } from "@/lib/tidb";
import { ApiError, apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest, props: { params: Promise<{ attachmentId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const rows = await executeQuery<any>(
      `SELECT aa.appwrite_file_id, aa.bucket_id, aa.file_name, aa.mime_type, a.classroom_id, NULL AS student_user_id, 'assignment' AS source_type
       FROM assignment_attachments aa JOIN homework_assignments a ON a.id = aa.assignment_id WHERE aa.id = ?
       UNION ALL
       SELECT sa.appwrite_file_id, sa.bucket_id, sa.file_name, sa.mime_type, a.classroom_id, s.student_user_id, 'submission' AS source_type
       FROM submission_attachments sa JOIN submission_versions sv ON sv.id = sa.submission_version_id
       JOIN homework_submissions s ON s.id = sv.submission_id JOIN homework_assignments a ON a.id = s.assignment_id WHERE sa.id = ? LIMIT 1`,
      [params.attachmentId, params.attachmentId]
    );
    const file = rows[0];
    if (!file) throw new ApiError(404, "Attachment not found");
    const membership = await getMembership(file.classroom_id, user.id);
    if (!membership) throw new ApiError(403, "Classroom access required");
    if (file.source_type === "submission" && membership.role !== "teacher" && file.student_user_id !== user.id) throw new ApiError(403, "Submission attachment access denied");
    const download = await storage.getFileDownload(file.bucket_id, file.appwrite_file_id);
    return new Response(download, { headers: { "Content-Type": file.mime_type || "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.file_name)}`, "Cache-Control": "private, no-store" } });
  } catch (error) { return apiErrorResponse(error); }
}
