import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

const reviewSchema = z.object({
  marks: z.number().min(0),
  remarks: z.string().max(20000).optional(),
  improvements: z.string().max(20000).optional(),
  overrideReason: z.string().max(4000).optional(),
  publish: z.boolean().default(false),
});

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; submissionId: string }> }
) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json(await classroomService.review(params.id, params.submissionId, user.id, reviewSchema.parse(await request.json())));
  } catch (error) { return apiErrorResponse(error); }
}
