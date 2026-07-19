import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("database migrations", () => {
  it("uses a unique, contiguous numbered migration sequence", () => {
    const files = fs.readdirSync(path.join(process.cwd(), "migrations")).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
    const numbers = files.map((file) => Number(file.slice(0, 3)));
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, index) => index));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("contains the durable agent, classroom, memory, and Codex-removal convergence migrations", () => {
    const sql = fs.readdirSync(path.join(process.cwd(), "migrations")).sort().map((file) => fs.readFileSync(path.join(process.cwd(), "migrations", file), "utf8")).join("\n");
    for (const table of ["agent_runs", "approval_requests", "user_memories", "classrooms", "homework_submissions", "teacher_reviews", "account_deletion_jobs"]) expect(sql).toContain(table);
    expect(sql).toContain("DELETE FROM ai_credentials WHERE provider = 'codex'");
    expect(sql).toContain("embedding_vector VECTOR(768)");
    expect(sql).toContain("idx_dashboard_items_favorite");
  });
});
