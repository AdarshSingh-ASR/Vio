import { describe, expect, it } from "vitest";
import { evaluateSubmissionPolicy } from "@/lib/classroom-policy";

describe("homework submission policy", () => {
  const now = new Date("2026-01-02T00:00:00Z");
  it("blocks late work when late submissions are disabled", () => {
    expect(evaluateSubmissionPolicy({ dueAt: new Date("2026-01-01T00:00:00Z"), now, allowLate: false, allowResubmission: true, existingVersions: 0 })).toMatchObject({ allowed: false, code: "LATE_NOT_ALLOWED" });
  });
  it("retains a distinct late flag when late work is allowed", () => {
    expect(evaluateSubmissionPolicy({ dueAt: new Date("2026-01-01T00:00:00Z"), now, allowLate: true, allowResubmission: true, existingVersions: 0 })).toEqual({ allowed: true, isLate: true });
  });
  it("blocks a second version when resubmissions are disabled", () => {
    expect(evaluateSubmissionPolicy({ dueAt: new Date("2026-01-03T00:00:00Z"), now, allowLate: false, allowResubmission: false, existingVersions: 1 })).toMatchObject({ allowed: false, code: "RESUBMISSION_NOT_ALLOWED" });
  });
});
