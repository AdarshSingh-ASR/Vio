import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiPreferencesService } from "@/lib/ai-preferences-service";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";

export async function GET(request: NextRequest) {
  try { const user = await requireDbUser(request); return NextResponse.json(await aiPreferencesService.get(user.id)); }
  catch (error) { return apiErrorResponse(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireDbUser(request);
    const input = z.object({ defaultProvider: z.enum(["built_in", "openai_byok"]), allowBuiltInFallback: z.boolean() }).parse(await request.json());
    return NextResponse.json(await aiPreferencesService.update(user.id, input));
  } catch (error) { return apiErrorResponse(error); }
}
