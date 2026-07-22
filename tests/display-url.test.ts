import { describe, expect, it } from "vitest";
import { getDisplayHostname } from "@/lib/display-url";

describe("getDisplayHostname", () => {
  it("returns a hostname for web links", () => {
    expect(getDisplayHostname("https://docs.example.com/lesson/1")).toBe("docs.example.com");
  });

  it("does not crash on file names or malformed stored values", () => {
    expect(getDisplayHostname("Dikshita_Resume_(1)[1].docx")).toBeNull();
    expect(getDisplayHostname("not a URL%zz")).toBeNull();
  });

  it("does not present non-web protocols as external sites", () => {
    expect(getDisplayHostname("javascript:alert(1)")).toBeNull();
    expect(getDisplayHostname("file:///tmp/lesson.pdf")).toBeNull();
  });
});
