import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedServices, storage, users } from "@/lib/appwrite-server";
import { executeQuery, executeSingle } from "@/lib/tidb";
import { ApiError, apiErrorResponse } from "@/lib/request-auth";
import { userService } from "@/lib/tidb-service";

type FileReference = { bucket_id: string; file_id: string };

async function ownedFiles(userId: string) {
  return executeQuery<FileReference>(
    `SELECT appwrite_bucket_id AS bucket_id, appwrite_file_id AS file_id
       FROM dashboard_items WHERE created_by=? AND appwrite_file_id IS NOT NULL
     UNION
     SELECT aa.bucket_id, aa.appwrite_file_id FROM assignment_attachments aa
       JOIN homework_assignments a ON a.id=aa.assignment_id
       JOIN classrooms c ON c.id=a.classroom_id WHERE c.owner_user_id=?
     UNION
     SELECT sa.bucket_id, sa.appwrite_file_id FROM submission_attachments sa
       JOIN submission_versions sv ON sv.id=sa.submission_version_id
       JOIN homework_submissions hs ON hs.id=sv.submission_id WHERE hs.student_user_id=?`,
    [userId, userId, userId],
  );
}

export async function DELETE(request: NextRequest) {
  const jobId = crypto.randomUUID();
  let dbUserId: string | null = null;
  try {
    const { user } = await getAuthenticatedServices(request);
    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) throw new ApiError(404, "User profile was not found", "USER_NOT_FOUND");
    dbUserId = dbUser.id;
    await executeSingle(
      `INSERT INTO account_deletion_jobs (id, user_id, appwrite_user_id) VALUES (?, ?, ?)`,
      [jobId, dbUser.id, user.$id],
    );

    for (const reference of await ownedFiles(dbUser.id)) {
      try {
        await storage.deleteFile(reference.bucket_id, reference.file_id);
      } catch (error) {
        const code = Number((error as { code?: unknown })?.code || 0);
        if (code !== 404) throw error;
      }
    }
    await executeSingle(`UPDATE account_deletion_jobs SET status='files_deleted', last_successful_stage='files_deleted' WHERE id=?`, [jobId]);

    await users.delete(user.$id);
    await executeSingle(`UPDATE account_deletion_jobs SET status='identity_deleted', last_successful_stage='identity_deleted' WHERE id=?`, [jobId]);

    await executeSingle(`DELETE FROM users WHERE id=?`, [dbUser.id]);
    await executeSingle(`UPDATE account_deletion_jobs SET status='completed', completed_at=UTC_TIMESTAMP() WHERE id=?`, [jobId]);
    return NextResponse.json({ success: true, message: "Account deleted successfully", deletionId: jobId });
  } catch (error) {
    if (dbUserId) {
      await executeSingle(
        `UPDATE account_deletion_jobs SET status='failed', error_code=? WHERE id=?`,
        [error instanceof Error ? error.name.slice(0, 100) : "ACCOUNT_DELETION_ERROR", jobId],
      ).catch(() => undefined);
    }
    return apiErrorResponse(error);
  }
}
