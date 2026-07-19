import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchWeb, extractContent } from "@/lib/tavily";
import { apiErrorResponse, requireDbUser } from "@/lib/request-auth";
import { enforceRateLimit } from "@/lib/rate-limit";

const inputSchema = z.object({ url: z.string().url().refine((value) => value.startsWith("https://"), "Only HTTPS URLs are supported").optional(), query: z.string().trim().min(2).max(500).optional() }).refine((value) => Boolean(value.url) !== Boolean(value.query), "Provide either url or query");

export async function POST(req: NextRequest) {
  try {
    const user = await requireDbUser(req);
    await enforceRateLimit(user.id, "metadata", 20, 60);
    const { url, query } = inputSchema.parse(await req.json());
    if (query) {
      // Tavily Search
      const response = await searchWeb(query);
      return NextResponse.json(response);
    }
    if (url) {
      // Tavily Extract
      const response = await extractContent([url]);
      return NextResponse.json(response);
    }
    return NextResponse.json({ error: "No url or query provided." }, { status: 400 });
  } catch (error) { return apiErrorResponse(error); }
}
