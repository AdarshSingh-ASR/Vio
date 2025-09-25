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

    console.log('🔍 Retrieving chat history for user:', dbUser.id, 'chatId:', chatId);

    try {
      // Fetch chat messages from TiDB
      let messages = await chatMessageService.getByChatId(chatId);
      
      // If no messages found with the current chatId, try alternative chat IDs
      // This helps with transitions between anonymous and authenticated states
      if (messages.length === 0) {
        const alternativeChatIds = [
          'vio-chat-session',
          'vio-chat-anonymous',
          `vio-chat-${dbUser.id}`
        ].filter(id => id !== chatId);
        
        for (const altChatId of alternativeChatIds) {
          const altMessages = await chatMessageService.getByChatId(altChatId);
          if (altMessages.length > 0) {
            console.log(`📚 Found ${altMessages.length} messages in alternative chat ID: ${altChatId}`);
            messages = altMessages;
            break;
          }
        }
      }

      console.log('✅ Retrieved messages:', messages.length, 'messages for chatId:', chatId);

      // Transform messages to match frontend expectations
      const transformedMessages = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt
      }));

      return NextResponse.json({ 
        messages: transformedMessages,
        count: transformedMessages.length,
        source: 'tidb',
        chatId: chatId
      });

    } catch (error) {
      console.error('❌ Error retrieving chat history:', error);
      
      // Fall back to empty history if anything fails
      return NextResponse.json({ 
        messages: [],
        error: 'Failed to retrieve chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

  } catch (error) {
    console.error('❌ Error in chat history API:', error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve chat history",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 