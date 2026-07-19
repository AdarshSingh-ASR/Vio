import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("public pages have no serious or critical automated accessibility violations", async ({ page }) => {
  for (const path of ["/", "/features", "/auth/sign-in"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const severe = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(severe, `${path}: ${severe.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
  }
});

test("authenticated dashboard and classroom index have no serious or critical violations", async ({ page }) => {
  const email = process.env.E2E_TEACHER_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD;
  if (!email || !password) throw new Error("Real teacher credentials are required for authenticated accessibility checks");
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  for (const path of ["/dashboard", "/dashboard/classrooms", "/dashboard/settings"]) {
    await page.goto(path);
    await page.getByRole("main").waitFor().catch(() => page.waitForLoadState("networkidle"));
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const severe = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
    expect(severe, `${path}: ${severe.map((item) => `${item.id} (${item.nodes.length})`).join(", ")}`).toEqual([]);
  }
});
