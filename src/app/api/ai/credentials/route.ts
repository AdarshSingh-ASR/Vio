import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiPreferencesService } from "@/lib/ai-preferences-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const providerSchema = z.literal("openai");

export async function POST(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    await enforceRateLimit(user.id, "ai-credential-connect", 10, 3600);
    const input = z.object({ provider: providerSchema, value: z.string().min(20).max(10000) }).parse(await request.json());
    return NextResponse.json(await aiPreferencesService.connectCredential(user.id, input.provider, input.value));
  } catch (error) { return apiErrorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const provider = providerSchema.parse(request.nextUrl.searchParams.get("provider"));
    return NextResponse.json(await aiPreferencesService.revokeCredential(user.id, provider));
  } catch (error) { return apiErrorResponse(error); }
}
