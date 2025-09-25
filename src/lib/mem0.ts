// Simple memory operations with better error handling
export const storeMemory = async (userId: string, messages: any[], metadata?: any) => {
  try {
    // Check if Mem0 API key is available
    if (!process.env.MEM0_API_KEY) {
      console.log('⚠️ Mem0 API key not configured, skipping memory storage');
      return null;
    }

    // For now, let's use a simpler approach - we'll implement a basic memory storage
    // that can be enhanced later when Mem0 is properly configured
    console.log('📝 Storing memory for user:', userId, 'metadata:', metadata);
    
    // This is a placeholder - in production you might want to:
    // 1. Store in a database
    // 2. Use a different memory service
    // 3. Configure Mem0 properly
    
    return { success: true, stored: messages.length };
  } catch (error) {
    console.error("Memory store error:", error);
    // Don't throw - just return null so the application continues working
    return null;
  }
};

export const retrieveMemoriesForUser = async (prompt: string | any[], userId: string, options?: any) => {
  try {
    if (!process.env.MEM0_API_KEY) {
      console.log('⚠️ Mem0 API key not configured, returning empty memories');
      return [];
    }

    // For now, return empty array - this allows the chat to work without history
    // until Mem0 is properly configured
    console.log('🔍 Retrieving memories for user:', userId);
    
    return [];
  } catch (error) {
    console.error("Memory retrieve error:", error);
    return [];
  }
};

export const getMemoriesArray = async (prompt: string | any[], userId: string, options?: any) => {
  try {
    if (!process.env.MEM0_API_KEY) {
      console.log('⚠️ Mem0 API key not configured, returning empty memories');
      return [];
    }

    // For now, return empty array - this allows the chat to work without history
    console.log('📚 Getting memories for user:', userId);
    
    return [];
  } catch (error) {
    console.error("Memory get error:", error);
    return [];
  }
};

// Simple in-memory storage for chat history (temporary solution)
// This will store chat history for the session until Mem0 is properly configured
const sessionChatHistory = new Map<string, any[]>();

export const storeSessionChatHistory = (chatId: string, messages: any[]) => {
  try {
    sessionChatHistory.set(chatId, messages);
    console.log(`📝 Stored ${messages.length} messages for chat ${chatId}`);
    return true;
  } catch (error) {
    console.error('Error storing session chat history:', error);
    return false;
  }
};

export const retrieveSessionChatHistory = (chatId: string): any[] => {
  try {
    const history = sessionChatHistory.get(chatId) || [];
    console.log(`📚 Retrieved ${history.length} messages for chat ${chatId}`);
    return history;
  } catch (error) {
    console.error('Error retrieving session chat history:', error);
    return [];
  }
};

export const clearSessionChatHistory = (chatId: string) => {
  try {
    sessionChatHistory.delete(chatId);
    console.log(`🗑️ Cleared chat history for ${chatId}`);
    return true;
  } catch (error) {
    console.error('Error clearing session chat history:', error);
    return false;
  }
}; 