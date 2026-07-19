import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/lib/conversation-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const { conversationId, chatId } = await request.json();
    const resolvedId = await conversationService.ensure(user.id, conversationId || chatId);
    await conversationService.clear(resolvedId, user.id);
    return NextResponse.json({ success: true });
  } catch (error) { return apiErrorResponse(error); }
}
