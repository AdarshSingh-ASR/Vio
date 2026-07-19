import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

const updateSchema = z.object({
  title: z.string().trim().min(2).max(255).optional(),
  lessonNumber: z.string().max(50).nullable().optional(),
  chapterNumber: z.string().max(50).nullable().optional(),
  chapterName: z.string().max(255).nullable().optional(),
  instructions: z.string().trim().min(3).max(50000).optional(),
  rubric: z.array(z.object({ criterion: z.string().trim().min(1), marks: z.number().positive() })).optional(),
  dueAt: z.string().datetime().optional(),
  maxMarks: z.number().positive().max(10000).optional(),
  allowLate: z.boolean().optional(),
  allowResubmission: z.boolean().optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  confirmAfterSubmissions: z.boolean().default(false),
});

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string; assignmentId: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json(await classroomService.updateAssignment(params.id, params.assignmentId, user.id, updateSchema.parse(await request.json())));
  } catch (error) { return apiErrorResponse(error); }
}
