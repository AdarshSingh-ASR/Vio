import { NextRequest, NextResponse } from "next/server";
import { enqueueHomeworkEvaluation } from "@/lib/agent-client";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function POST(request: NextRequest, props: { params: Promise<{ id: string; submissionId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const evaluation = await classroomService.createReevaluation(params.id, params.submissionId, user.id);
    const queue = await enqueueHomeworkEvaluation({ userId: evaluation.ownerUserId, classroomId: params.id, submissionId: params.submissionId, versionId: evaluation.versionId });
    return NextResponse.json({ queued: queue.queued, versionId: evaluation.versionId }, { status: 202 });
  } catch (error) { return apiErrorResponse(error); }
}
