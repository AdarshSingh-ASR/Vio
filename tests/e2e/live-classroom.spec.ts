import { expect, test, type Page } from "@playwright/test";

const teacher = { email: process.env.E2E_TEACHER_EMAIL, password: process.env.E2E_TEACHER_PASSWORD };
const student = { email: process.env.E2E_STUDENT_EMAIL, password: process.env.E2E_STUDENT_PASSWORD };

function requireAccounts() {
  if (!teacher.email || !teacher.password || !student.email || !student.password) {
    throw new Error("E2E_TEACHER_EMAIL, E2E_TEACHER_PASSWORD, E2E_STUDENT_EMAIL, and E2E_STUDENT_PASSWORD are required");
  }
}

async function signIn(page: Page, account: { email?: string; password?: string }) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(account.email!);
  await page.getByLabel("Password").fill(account.password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("real teacher/student homework lifecycle with AI evaluation and teacher publication", async ({ browser }) => {
  requireAccounts();
  const suffix = Date.now().toString(36);
  const classroomName = `Vio live verification ${suffix}`;
  const homeworkTitle = `Evidence task ${suffix}`;
  let classroomUrl: string | null = null;

  const teacherContext = await browser.newContext();
  const studentContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  const studentPage = await studentContext.newPage();

  try {
    await signIn(teacherPage, teacher);
    await teacherPage.goto("/dashboard/classrooms");
    await teacherPage.getByRole("button", { name: "Create classroom" }).click();
    await teacherPage.locator('input[name="name"]').fill(classroomName);
    await teacherPage.locator('input[name="subject"]').fill("Production verification");
    await teacherPage.locator('textarea[name="description"]').fill("Created by the live production-readiness suite.");
    await teacherPage.getByRole("button", { name: "Create", exact: true }).click();
    await expect(teacherPage.getByText(classroomName)).toBeVisible();
    await teacherPage.getByText(classroomName).click();
    classroomUrl = teacherPage.url();

    await teacherPage.getByRole("button", { name: "Invite" }).click();
    await teacherPage.getByRole("button", { name: "Generate invite code" }).click();
    const code = (await teacherPage.locator(".font-mono").innerText()).trim();
    expect(code.length).toBeGreaterThanOrEqual(6);

    await signIn(studentPage, student);
    await studentPage.goto("/dashboard/classrooms");
    await studentPage.getByRole("button", { name: "Join with code" }).click();
    await studentPage.getByLabel("Invite code").fill(code);
    await studentPage.getByRole("button", { name: "Join classroom" }).click();
    await expect(studentPage.getByText(classroomName)).toBeVisible();

    await teacherPage.keyboard.press("Escape");
    await teacherPage.getByRole("button", { name: "New homework" }).click();
    await teacherPage.locator('input[name="title"]').fill(homeworkTitle);
    await teacherPage.locator('textarea[name="instructions"]').fill("Explain why evidence and citations improve the reliability of an educational answer.");
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await teacherPage.locator('input[name="dueAt"]').fill(tomorrow.toISOString().slice(0, 16));
    await teacherPage.locator('input[name="maxMarks"]').fill("20");
    await teacherPage.locator('label:has-text("Publish immediately") button').click();
    await teacherPage.getByRole("button", { name: "Create homework" }).click();
    await expect(teacherPage.getByText(homeworkTitle)).toBeVisible();

    await studentPage.reload();
    await studentPage.getByText(classroomName).click();
    await studentPage.getByText(homeworkTitle).click();
    await studentPage.locator('textarea[name="textContent"]').fill(
      "Evidence makes claims traceable to their sources. Citations let readers verify context, detect unsupported conclusions, and distinguish retrieved facts from generated explanation.",
    );
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(studentPage.getByText("Submission received")).toBeVisible();

    await teacherPage.getByText(homeworkTitle).click();
    await expect(teacherPage.getByText(/1\/1/)).toBeVisible();
    await expect.poll(async () => {
      await teacherPage.reload();
      return teacherPage.getByText(/AI: \d/).count();
    }, { timeout: 120_000, intervals: [5_000] }).toBeGreaterThan(0);

    await teacherPage.getByRole("button", { name: "Review", exact: true }).click();
    await expect(teacherPage.getByText("AI evaluation")).toBeVisible();
    await teacherPage.locator('textarea[name="remarks"]').fill("Clear explanation with an appropriate reliability argument.");
    await teacherPage.locator('textarea[name="improvements"]').fill("Add one concrete source-quality example next time.");
    await teacherPage.getByRole("button", { name: "Publish result" }).click();
    await expect(teacherPage.getByText("Published by teacher")).toBeVisible();

    await studentPage.reload();
    await expect(studentPage.getByText("Teacher remarks")).toBeVisible();
    await expect(studentPage.getByText("AI-generated feedback")).toBeVisible();
  } finally {
    if (classroomUrl) {
      try {
        await teacherPage.goto(classroomUrl);
        teacherPage.once("dialog", (dialog) => dialog.accept());
        await teacherPage.getByRole("button", { name: "Archive classroom" }).click();
      } catch {
        // The timestamped classroom remains auditable when cleanup cannot complete.
      }
    }
    await teacherContext.close();
    await studentContext.close();
  }
});
