import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteMemory, retrieveMemoriesForUser, storeMemory } from "@/lib/mem0";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    return NextResponse.json({ memories: await retrieveMemoriesForUser("", user.id, { limit: 50 }) });
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    await deleteMemory(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) { return apiErrorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const input = z.object({
      key: z.string().trim().min(2).max(255),
      content: z.string().trim().min(2).max(2000),
      expiresAt: z.string().datetime().optional(),
    }).parse(await request.json());
    const result = await storeMemory(user.id, [{ role: "user", content: input.content }], {
      memoryKey: input.key,
      source: "user_explicit",
      confidence: 1,
      expiresAt: input.expiresAt,
      strict: true,
    });
    return NextResponse.json({ memory: result }, { status: 201 });
  } catch (error) { return apiErrorResponse(error); }
}
