import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  executeQuery: vi.fn(),
  executeSingle: vi.fn(),
  connectionExecute: vi.fn(),
}));

vi.mock("@/lib/tidb", () => ({
  executeQuery: database.executeQuery,
  executeSingle: database.executeSingle,
  withTransaction: async (callback: (connection: { execute: typeof database.connectionExecute }) => unknown) =>
    callback({ execute: database.connectionExecute }),
}));

import { retrieveMemoriesForUser, storeMemory } from "@/lib/mem0";

describe("curated memory policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.executeQuery.mockResolvedValue([{ id: "user-1" }]);
    database.connectionExecute.mockResolvedValue([{}]);
  });

  it("supersedes an older fact with the same stable memory key", async () => {
    const result = await storeMemory(
      "appwrite-user-1",
      [{ role: "user", content: "I now prefer concise checklists." }],
      { memoryKey: "explanation_style", source: "user_explicit", strict: true },
    );

    expect(result).toMatchObject({ success: true });
    expect(database.connectionExecute).toHaveBeenCalledTimes(2);
    expect(database.connectionExecute.mock.calls[1][0]).toContain("superseded_by");
    expect(database.connectionExecute.mock.calls[1][1]).toEqual(
      expect.arrayContaining(["user-1", "user", "explanation_style"]),
    );
  });

  it("refuses credentials and private grading data", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(storeMemory(
      "user-1",
      [{ role: "user", content: "Remember my API key is sk-private-secret" }],
      { strict: true },
    )).rejects.toThrow("cannot be stored");
    errorLog.mockRestore();
    expect(database.connectionExecute).not.toHaveBeenCalled();
  });

  it("retrieves only current, scoped, sufficiently confident memories", async () => {
    database.executeQuery
      .mockResolvedValueOnce([{ id: "user-1" }])
      .mockResolvedValueOnce([{ id: "memory-1", content: "Use diagrams" }]);

    const memories = await retrieveMemoriesForUser("Make a biology diagram", "user-1", {
      scopeType: "classroom",
      scopeId: "classroom-1",
      minConfidence: 0.8,
      limit: 4,
    });

    expect(memories).toHaveLength(1);
    const [sql, values] = database.executeQuery.mock.calls[1];
    expect(sql).toContain("superseded_by IS NULL");
    expect(sql).toContain("expires_at");
    expect(values).toEqual(expect.arrayContaining(["user-1", 0.8, "classroom", "classroom-1", 4]));
  });
});
