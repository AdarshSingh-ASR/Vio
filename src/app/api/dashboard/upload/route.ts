import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unfurl } from "unfurl.js";

import { getAuthenticatedServices } from "@/lib/appwrite-server";
import { extractContentFromUrl } from "@/lib/content-extractor";
import { dashboardItemService, userService, workspaceService } from "@/lib/tidb-service";

export const runtime = "nodejs";

const linkSchema = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "Only HTTP and HTTPS links are supported");

async function defaultWorkspaceId(userId: string) {
  const workspaces = await workspaceService.getByUserId(userId);
  if (workspaces.length > 0) return workspaces[0].id;
  const workspace = await workspaceService.create({
    name: "Default Workspace",
    description: "Default workspace for user files",
    userId,
    isDefault: true,
  });
  return workspace.id;
}

/**
 * Register a URL as a dashboard item. Binary uploads deliberately use
 * /api/dashboard/upload/register after a direct, owner-scoped Appwrite upload.
 * This route never buffers files in a Next.js function.
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await getAuthenticatedServices(request);
    const formData = await request.formData();

    if (formData.get("file")) {
      return NextResponse.json(
        { error: "Upload the file directly to secure storage, then register it with /api/dashboard/upload/register." },
        { status: 409 },
      );
    }

    const parsed = linkSchema.safeParse(formData.get("link"));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "A valid link is required." }, { status: 400 });
    }

    const dbUser = await userService.getByAppwriteUserId(user.$id);
    if (!dbUser) return NextResponse.json({ error: "User not found in database" }, { status: 404 });

    const link = parsed.data;
    const [previewResult, contentResult] = await Promise.allSettled([
      unfurl(link),
      extractContentFromUrl(link),
    ]);

    const preview = previewResult.status === "fulfilled" ? previewResult.value : null;
    const extracted = contentResult.status === "fulfilled" && contentResult.value.success
      ? contentResult.value
      : null;
    const title = extracted?.metadata?.title || preview?.title || link;
    const previewImage = preview?.open_graph?.images?.[0]?.url;

    const item = await dashboardItemService.create({
      title,
      displayName: title,
      description: `Link: ${link}`,
      content: extracted?.content || "",
      previewImageUrl: previewImage || undefined,
      fileType: "link",
      fileSize: 0,
      fileUrl: link,
      appwriteFileId: undefined,
      appwriteBucketId: undefined,
      workspaceId: await defaultWorkspaceId(dbUser.id),
      createdBy: dbUser.id,
    });

    return NextResponse.json({ success: true, message: "Link saved successfully", item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const unauthorized = /JWT|Authentication|session/i.test(message);
    console.error("Dashboard link registration failed", { code: error instanceof Error ? error.name : "UNKNOWN" });
    return NextResponse.json(
      { error: unauthorized ? "Authentication required" : "Failed to save link" },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
