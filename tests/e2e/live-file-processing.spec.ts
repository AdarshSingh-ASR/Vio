import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test("a real document is uploaded, asynchronously extracted, and becomes readable", async ({ page }) => {
  const email = process.env.E2E_TEACHER_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD;
  const configuredPath = process.env.E2E_DOCUMENT_PATH;
  if (!email || !password || !configuredPath) throw new Error("Teacher credentials and E2E_DOCUMENT_PATH are required");
  const documentPath = path.resolve(configuredPath);
  if (!fs.existsSync(documentPath)) throw new Error(`E2E_DOCUMENT_PATH does not exist: ${documentPath}`);
  if (!/\.(pdf|docx|pptx|xlsx|png|jpe?g)$/i.test(documentPath)) throw new Error("E2E_DOCUMENT_PATH must be a supported document or image");

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard");
  await page.locator("#file-upload").setInputFiles(documentPath);
  await page.locator("form").filter({ has: page.locator("#file-upload") }).getByRole("button", { name: "Save" }).click();
  const name = path.basename(documentPath);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.getByText(name, { exact: true }).first().click();

  await expect.poll(async () => {
    await page.reload();
    const body = await page.locator("body").innerText();
    return !body.includes("File processing is in progress.") && !body.includes("Processing file");
  }, { timeout: 180_000, intervals: [5_000] }).toBe(true);
  await expect(page.locator("body")).not.toContainText("No readable content was extracted");
});
