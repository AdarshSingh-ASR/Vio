import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceText(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

describe("removed runtime features", () => {
  it("does not expose Learning Script Studio routes or renderer dependencies", () => {
    expect(fs.existsSync(path.join(root, "src/app/dashboard/learning-script-studio"))).toBe(false);
    expect(fs.existsSync(path.join(root, "src/app/api/learning-script-studio"))).toBe(false);
    const packageJson = sourceText("package.json");
    for (const dependency of ["@ffmpeg", "manim", "canvas", "three"]) expect(packageJson.toLowerCase()).not.toContain(`\"${dependency}`);
  });

  it("does not contain a Codex runtime connector or client path", () => {
    const connectorPath = path.join(root, "services/codex-connector");
    expect(!fs.existsSync(connectorPath) || fs.readdirSync(connectorPath).length === 0).toBe(true);
    const runtimeFiles = [
      "src/app/api/chat/route.ts",
      "src/lib/ai-preferences-service.ts",
      "src/components/settings/AIProviderSettings.tsx",
      "env.example",
    ].map(sourceText).join("\n");
    expect(runtimeFiles).not.toMatch(/CODEX_CONNECTOR|ENABLE_CODEX|codexAccessToken|agent_engine|Enterprise Codex/i);
  });

  it("prevents students from downloading another student's submission attachment", () => {
    const route = sourceText("src/app/api/classrooms/files/[attachmentId]/route.ts");
    expect(route).toContain('file.source_type === "submission"');
    expect(route).toContain("file.student_user_id !== user.id");
  });
});
