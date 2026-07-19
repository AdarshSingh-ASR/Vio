import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("production persistence boundary", () => {
  it("uses Appwrite only for identity and files at runtime", () => {
    const appwrite = fs.readFileSync(path.join(root, "src/lib/appwrite.ts"), "utf8");
    const server = fs.readFileSync(path.join(root, "src/lib/appwrite-server.ts"), "utf8");
    const workspace = fs.readFileSync(path.join(root, "src/actions/workspace.ts"), "utf8");
    expect(`${appwrite}\n${server}`).not.toMatch(/\bDatabases\b|COLLECTIONS|createDocument|listDocuments/);
    expect(workspace).toMatch(/workspaceService/);
    expect(workspace).not.toMatch(/\bDatabases\b|COLLECTIONS/);
    expect(fs.existsSync(path.join(root, "src/actions/user.ts"))).toBe(false);
  });

  it("keeps account deletion resumable and auditable", () => {
    const migration = fs.readFileSync(path.join(root, "migrations/014_account_deletion_saga.sql"), "utf8");
    const route = fs.readFileSync(path.join(root, "src/app/api/user/delete/route.ts"), "utf8");
    expect(migration).toContain("account_deletion_jobs");
    expect(migration).toContain("last_successful_stage");
    expect(route).toContain("storage.deleteFile");
    expect(route).toContain("users.delete");
    expect(route).toContain("DELETE FROM users");
  });
});
