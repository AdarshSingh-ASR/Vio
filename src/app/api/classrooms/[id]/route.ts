import { NextRequest, NextResponse } from "next/server";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json({ classroom: await classroomService.get(params.id, user.id) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json(await classroomService.archive(params.id, user.id));
  } catch (error) { return apiErrorResponse(error); }
}
