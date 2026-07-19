import { NextRequest, NextResponse } from "next/server";
import { getMembership } from "@/lib/classroom-service";
import { z } from "zod";
import { registerStoredClassroomFile, uploadClassroomFiles } from "@/lib/classroom-files";
import { ApiError, apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { executeQuery } from "@/lib/tidb";

const storedFilesSchema = z.object({ storedFiles: z.array(z.object({ fileId: z.string().min(1).max(255), bucketId: z.string().min(1).max(255) })).min(1).max(10) });

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const membership = await getMembership(params.id, user.id);
    if (membership?.role !== "teacher") throw new ApiError(403, "Teacher access required");
    const assignments = await executeQuery<any>(`SELECT id FROM homework_assignments WHERE id=? AND classroom_id=?`, [params.assignmentId, params.id]);
    if (!assignments[0]) throw new ApiError(404, "Homework not found");
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const input = storedFilesSchema.parse(await request.json());
      const attachments = [];
      for (const file of input.storedFiles) attachments.push(await registerStoredClassroomFile(request, file, { type: "assignment", id: params.assignmentId, userId: user.id }));
      return NextResponse.json({ attachments }, { status: 201 });
    }
    const formData = await request.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    return NextResponse.json({ attachments: await uploadClassroomFiles(request, files, { type: "assignment", id: params.assignmentId, userId: user.id }) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
