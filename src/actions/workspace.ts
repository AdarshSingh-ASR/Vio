"use server";

import { cookies } from "next/headers";
import { Account, Client } from "node-appwrite";

import { userService, workspaceService } from "@/lib/tidb-service";

async function currentDbUser() {
  const session = (await cookies()).get("appwrite-session")?.value;
  if (!session) return null;
  try {
    const account = new Account(
      new Client()
        .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1")
        .setProject(process.env.APPWRITE_PROJECT_ID || "")
        .setSession(session),
    );
    const identity = await account.get();
    return userService.getByAppwriteUserId(identity.$id);
  } catch {
    return null;
  }
}

export async function verifyWorkspaceAccess(workspaceId: string) {
  const user = await currentDbUser();
  if (!user) return { status: 403, data: { error: "Unauthorized" } };
  const workspace = await workspaceService.getById(workspaceId);
  if (!workspace || workspace.userId !== user.id) return { status: 404, data: { error: "Workspace not found or access denied" } };
  return { status: 200, data: workspace };
}

export async function getWorkspaces() {
  const user = await currentDbUser();
  if (!user) return { status: 403, data: [] };
  return { status: 200, data: await workspaceService.getByUserId(user.id) };
}

export async function createWorkspace(name: string) {
  const user = await currentDbUser();
  if (!user) return { status: 403, data: "Unauthorized" };
  const normalized = name.trim();
  if (normalized.length < 2 || normalized.length > 255) return { status: 400, data: "Workspace name must contain 2-255 characters" };
  const workspace = await workspaceService.create({ name: normalized, userId: user.id, isDefault: false });
  return { status: 201, data: workspace };
}
