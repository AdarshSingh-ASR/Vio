import { NextRequest, NextResponse } from 'next/server';
import { workspaceService } from '@/lib/tidb-service';
import { apiErrorResponse, requireDbUser } from '@/lib/request-auth';

// Force this route to be dynamic
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireDbUser(req);
    return NextResponse.json(await workspaceService.getByUserId(user.id));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
