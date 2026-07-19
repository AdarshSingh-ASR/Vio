import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const { code } = z.object({ code: z.string().trim().min(6).max(32) }).parse(await request.json());
    return NextResponse.json(await classroomService.join(user.id, code));
  } catch (error) { return apiErrorResponse(error); }
}
