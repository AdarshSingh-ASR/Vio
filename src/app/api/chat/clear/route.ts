import { NextRequest, NextResponse } from "next/server";
import { userService, chatMessageService } from "@/lib/tidb-service";
import { getCurrentUser } from "@/lib/appwrite-server";

export async function POST(req: NextRequest) {
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(req);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { chatId } = await req.json();

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    console.log('🗑️ Clearing chat history for user:', dbUser.id, 'chatId:', chatId);

    try {
      // Clear chat history from TiDB
      await chatMessageService.deleteByChatId(chatId);
      
      console.log('✅ Chat history cleared successfully');
      return NextResponse.json({ 
        success: true,
        message: "Chat history cleared successfully"
      });

    } catch (error) {
      console.error('❌ Error clearing chat history:', error);
      
      return NextResponse.json({ 
        success: false,
        error: 'Failed to clear chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Error in clear chat history API:', error);
    return NextResponse.json(
      { 
        error: "Failed to clear chat history",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 