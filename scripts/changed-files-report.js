const { execFileSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const root = process.cwd();
const porcelain = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).trimEnd();
const entries = porcelain ? porcelain.split(/\r?\n/) : [];
const body = [
  "# Changed files",
  "",
  "This snapshot is generated directly from `git status --porcelain=v1 --untracked-files=all`.",
  "Regenerate immediately before release with `npm run report:changed-files`.",
  "",
  `Total changed paths: ${entries.length}`,
  "",
  "```text",
  ...entries,
  "```",
  "",
].join("\n");

writeFileSync(join(root, "docs", "CHANGED_FILES.md"), body, "utf8");
console.log(`Wrote docs/CHANGED_FILES.md with ${entries.length} paths`);
