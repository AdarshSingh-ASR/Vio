import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classroomService } from "@/lib/classroom-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    return NextResponse.json({ invites: await classroomService.listInvites(params.id, user.id) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const user = await requireDbUser(request);
    const input = z.object({ expiresInDays: z.number().int().min(1).max(30).default(7), maxUses: z.number().int().min(1).max(500).default(50) }).parse(await request.json().catch(() => ({})));
    const invite = await classroomService.createInvite(params.id, user.id, input.expiresInDays, input.maxUses);
    const base = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    return NextResponse.json({ invite: { ...invite, link: `${base.replace(/\/$/, "")}/dashboard/classrooms?join=${encodeURIComponent(invite.code)}` } }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
