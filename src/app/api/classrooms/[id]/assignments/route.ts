import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

const assignmentSchema = z.object({
  title: z.string().trim().min(2).max(255),
  lessonNumber: z.string().max(50).optional(),
  chapterNumber: z.string().max(50).optional(),
  chapterName: z.string().max(255).optional(),
  instructions: z.string().trim().min(3).max(50000),
  rubric: z.array(z.object({ criterion: z.string(), marks: z.number().positive() })).optional(),
  dueAt: z.string().datetime(),
  maxMarks: z.number().positive().max(10000).default(100),
  allowLate: z.boolean().default(false),
  allowResubmission: z.boolean().default(true),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const input = assignmentSchema.parse(await request.json());
    return NextResponse.json({ assignment: await classroomService.createAssignment(params.id, user.id, input) }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
