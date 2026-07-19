import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService, getMembership } from "@/lib/classroom-service";
import { enqueueHomeworkEvaluation } from "@/lib/agent-client";
import { registerStoredClassroomFile, uploadClassroomFiles } from "@/lib/classroom-files";
import { ApiError, apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { executeQuery } from "@/lib/tidb";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const membership = await getMembership(params.id, user.id);
    if (!membership) throw new ApiError(403, "Classroom access required");
    if (membership.role === "teacher") {
      return NextResponse.json({ submissions: await classroomService.listSubmissions(params.id, params.assignmentId, user.id) });
    }
    return NextResponse.json({ submission: await classroomService.getStudentSubmission(params.id, params.assignmentId, user.id) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const contentType = request.headers.get("content-type") || "";
    let textContent: string;
    let files: File[] = [];
    let storedFiles: { fileId: string; bucketId: string }[] = [];
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      textContent = z.string().trim().max(100000).catch("").parse(formData.get("textContent"));
      files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
      if (!textContent && !files.length) throw new ApiError(400, "Add written work or at least one attachment", "SUBMISSION_EMPTY");
    } else {
      const input = z.object({
        textContent: z.string().trim().max(100000).default(""),
        storedFiles: z.array(z.object({ fileId: z.string().min(1).max(255), bucketId: z.string().min(1).max(255) })).max(10).default([]),
      }).parse(await request.json());
      textContent = input.textContent;
      storedFiles = input.storedFiles;
      if (!textContent && !storedFiles.length) throw new ApiError(400, "Add written work or at least one attachment", "SUBMISSION_EMPTY");
    }
    const submission = await classroomService.submit(params.id, params.assignmentId, user.id, textContent);
    const attachments = await uploadClassroomFiles(request, files, { type: "submission", id: submission.versionId, userId: user.id });
    for (const file of storedFiles) attachments.push(await registerStoredClassroomFile(request, file, { type: "submission", id: submission.versionId, userId: user.id }));
    let evaluationQueued = false;
    try {
      const owners = await executeQuery<any>(`SELECT owner_user_id FROM classrooms WHERE id=?`, [params.id]);
      if (!owners[0]) throw new Error("Classroom owner not found");
      evaluationQueued = (await enqueueHomeworkEvaluation({ userId: owners[0].owner_user_id, classroomId: params.id, submissionId: submission.submissionId, versionId: submission.versionId })).queued;
    } catch (error) {
      console.error("Failed to enqueue homework evaluation", error);
    }
    return NextResponse.json({ submission: { ...submission, attachments }, evaluationQueued }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
