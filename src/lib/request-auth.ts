import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/appwrite-server";
import { userService } from "@/lib/tidb-service";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export async function requireDbUser(request: NextRequest) {
  const appwriteUser = await getCurrentUser(request);
  if (!appwriteUser) throw new ApiError(401, "Authentication required", "UNAUTHENTICATED");

  const user = await userService.getByAppwriteUserId(appwriteUser.$id);
  if (!user) throw new ApiError(404, "User profile is not initialized", "USER_NOT_FOUND");
  return user;
}

export function apiErrorResponse(error: unknown) {
  const { NextResponse } = require("next/server") as typeof import("next/server");
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Request validation failed", code: "VALIDATION_ERROR", details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  }
  console.error(error);
  return NextResponse.json({ error: "Unexpected server error", code: "INTERNAL_ERROR" }, { status: 500 });
}
