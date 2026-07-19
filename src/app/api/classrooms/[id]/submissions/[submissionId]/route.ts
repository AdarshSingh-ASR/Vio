import { NextRequest, NextResponse } from "next/server";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string; submissionId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json({ versions: await classroomService.getSubmissionVersions(params.id, params.submissionId, user.id) });
  } catch (error) { return apiErrorResponse(error); }
}
