import { NextRequest, NextResponse } from "next/server";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string; inviteId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json(await classroomService.revokeInvite(params.id, params.inviteId, user.id));
  } catch (error) { return apiErrorResponse(error); }
}
