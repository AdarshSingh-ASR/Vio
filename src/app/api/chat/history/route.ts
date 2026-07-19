import { NextRequest, NextResponse } from "next/server";
import { conversationService } from "@/lib/conversation-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const { conversationId, chatId, limit, before } = z.object({ conversationId: z.string().optional(), chatId: z.string().optional(), limit: z.number().int().min(1).max(100).default(50), before: z.string().optional() }).parse(await request.json());
    const resolvedId = await conversationService.ensure(user.id, conversationId || chatId);
    const messages = await conversationService.history(resolvedId, user.id, limit, before);
    return NextResponse.json({ conversationId: resolvedId, hasMore: messages.length === limit, nextCursor: messages[0] ? `${new Date(messages[0].created_at).toISOString()}|${messages[0].id}` : null, messages: messages.map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.created_at, metadata: { provider: message.provider, model: message.model, status: message.status } })) });
  } catch (error) { return apiErrorResponse(error); }
}
