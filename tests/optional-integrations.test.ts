import { describe, expect, it } from "vitest";

describe("optional integrations", () => {
  it("does not require Tavily during module evaluation", async () => {
    const tavilyModule = await import("@/lib/tavily");
    expect(tavilyModule.searchWeb).toBeTypeOf("function");
    expect(tavilyModule.extractContent).toBeTypeOf("function");
  });
});
