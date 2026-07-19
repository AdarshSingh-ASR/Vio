import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

const createSchema = z.object({
  name: z.string().trim().min(2).max(255),
  subject: z.string().trim().max(255).optional(),
  description: z.string().trim().max(4000).optional(),
  workspaceId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    return NextResponse.json({ classrooms: await classroomService.listForUser(user.id) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const input = createSchema.parse(await request.json());
    return NextResponse.json({ classroom: await classroomService.create(user.id, input) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
