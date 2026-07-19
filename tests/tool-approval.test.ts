import { describe, expect, it } from "vitest";
import { canonicalizeToolArguments } from "@/lib/tool-audit";

describe("sensitive tool approval arguments", () => {
  it("treats key ordering as equivalent", () => {
    expect(canonicalizeToolArguments({ marks: 82, classroom_id: "one", nested: { b: 2, a: 1 } })).toBe(canonicalizeToolArguments({ nested: { a: 1, b: 2 }, classroomId: "one", marks: 82 }));
  });

  it("detects a changed sensitive action", () => {
    expect(canonicalizeToolArguments({ submissionId: "approved", marks: 82 })).not.toBe(canonicalizeToolArguments({ submissionId: "different", marks: 82 }));
  });
});
