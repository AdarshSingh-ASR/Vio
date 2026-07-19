import { NextRequest, NextResponse } from "next/server";
import { verifyAgentContextToken } from "@/lib/agent-client";
import { decryptSecret } from "@/lib/credential-vault";
import { executeQuery } from "@/lib/tidb";

export async function GET(request: NextRequest) {
  const context = verifyAgentContextToken(request.headers.get("X-Vio-Agent-Token"));
  if (!context || !context.permissions.includes("homework:evaluate")) {
    return NextResponse.json({ error: "Invalid credential service authorization" }, { status: 401 });
  }
  const credentials = await executeQuery<any>(
    `SELECT encrypted_value, key_version FROM ai_credentials
     WHERE user_id=? AND provider='openai' AND status='active' LIMIT 1`,
    [context.userId]
  );
  if (!credentials[0]) return NextResponse.json({ error: "OpenAI credential not found" }, { status: 404 });
  const key = await decryptSecret({ ciphertext: credentials[0].encrypted_value, keyVersion: credentials[0].key_version });
  return NextResponse.json({ key }, { headers: { "Cache-Control": "private, no-store" } });
}
