export function evaluateSubmissionPolicy(input: { dueAt: Date; now?: Date; allowLate: boolean; allowResubmission: boolean; existingVersions: number }) {
  const isLate = input.dueAt.getTime() < (input.now || new Date()).getTime();
  if (isLate && !input.allowLate) return { allowed: false as const, isLate, code: "LATE_NOT_ALLOWED" as const };
  if (input.existingVersions > 0 && !input.allowResubmission) return { allowed: false as const, isLate, code: "RESUBMISSION_NOT_ALLOWED" as const };
  return { allowed: true as const, isLate };
}
