import { afterEach, describe, expect, it } from "vitest";
import { createAgentContextToken, verifyAgentContextToken } from "@/lib/agent-client";

describe("internal agent context tokens", () => {
  const original = process.env.AGENT_SHARED_SECRET;
  afterEach(() => { process.env.AGENT_SHARED_SECRET = original; });

  it("round-trips user and scoped permissions", () => {
    process.env.AGENT_SHARED_SECRET = "test-secret-with-enough-entropy";
    const token = createAgentContextToken("user-123", ["documents:read"]);
    expect(verifyAgentContextToken(token)).toEqual({ userId: "user-123", permissions: ["documents:read"] });
  });

  it("binds a token to its run and conversation", () => {
    process.env.AGENT_SHARED_SECRET = "test-secret-with-enough-entropy";
    const token = createAgentContextToken("user-123", ["documents:read"], { runId: "run-1", conversationId: "conversation-1", traceId: "trace-1" });
    expect(verifyAgentContextToken(token)).toEqual({ userId: "user-123", permissions: ["documents:read"], runId: "run-1", conversationId: "conversation-1", traceId: "trace-1" });
  });

  it("rejects a modified signature", () => {
    process.env.AGENT_SHARED_SECRET = "test-secret-with-enough-entropy";
    const token = createAgentContextToken("user-123");
    expect(verifyAgentContextToken(`${token.slice(0, -1)}x`)).toBeNull();
  });
});
