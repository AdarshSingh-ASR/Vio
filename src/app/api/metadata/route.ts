import { NextResponse } from "next/server";
import { searchWeb, extractContent } from "@/lib/tavily";

export async function POST(req: Request) {
  try {
    const { url, query } = await req.json();
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unknown error" }, { status: 500 });
  }
} 