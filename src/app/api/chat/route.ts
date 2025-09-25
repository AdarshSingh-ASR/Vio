import { NextRequest, NextResponse } from "next/server";
import { userService, chatMessageService } from "@/lib/tidb-service";
import { getCurrentUser } from "@/lib/appwrite-server";
import { storeMemory } from "@/lib/mem0";
import { logLLMRequest, trackAIFeature } from "@/lib/keywords-ai";

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  userId: string;
  chatId: string;
  contextItems?: string[];
}

// Groq API integration
async function callGroqAPI(messages: ChatMessage[]): Promise<{ content: string; tokens: number }> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

  // Convert messages to Groq format
  const groqMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant', // Using current Llama 3.1 8B model
      messages: groqMessages,
      max_tokens: 2048,
      temperature: 0.7,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || 'No response generated',
    tokens: data.usage?.total_tokens || 0
  };
}

// OpenAI API integration (fallback)
async function callOpenAIAPI(messages: ChatMessage[]): Promise<{ content: string; tokens: number }> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  // Convert messages to OpenAI format
  const openaiMessages = messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));

  const response = await fetch(`${openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      max_tokens: 2048,
      temperature: 0.7,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0]?.message?.content || 'No response generated',
    tokens: data.usage?.total_tokens || 0
  };
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get current user from JWT
    const appwriteUser = await getCurrentUser(req);
    if (!appwriteUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user from TiDB database
    const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    const { messages, userId, chatId, contextItems }: ChatRequest = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    console.log('🤖 Processing chat request:', {
      userId: dbUser.id,
      chatId,
      messageCount: messages.length,
      contextItems: contextItems?.length || 0
    });

    let response: { content: string; tokens: number };
    let provider: 'groq' | 'openai' = 'groq';

    try {
      // Try Groq first
      console.log('🚀 Attempting Groq Llama3...');
      response = await callGroqAPI(messages);
      provider = 'groq';
      console.log('✅ Groq response successful:', { tokens: response.tokens });
    } catch (groqError) {
      console.warn('⚠️ Groq failed, falling back to OpenAI:', groqError);
      
      try {
        // Fallback to OpenAI
        console.log('🔄 Attempting OpenAI fallback...');
        response = await callOpenAIAPI(messages);
        provider = 'openai';
        console.log('✅ OpenAI response successful:', { tokens: response.tokens });
      } catch (openaiError) {
        console.error('❌ Both Groq and OpenAI failed:', { groqError, openaiError });
        return NextResponse.json(
          { 
            error: 'AI service temporarily unavailable',
            details: 'Both Groq and OpenAI services are currently unavailable. Please try again later.'
          }, 
          { status: 503 }
        );
      }
    }

    const responseTime = Date.now() - startTime;

    // Store the conversation in TiDB
    try {
      // Store user message
      await chatMessageService.create({
        userId: dbUser.id,
        chatId,
        role: 'user',
        content: lastMessage.content,
        metadata: {
          responseTime,
          provider: 'input',
          contextItems: contextItems || []
        }
      });

      // Store assistant message
      await chatMessageService.create({
        userId: dbUser.id,
        chatId,
        role: 'assistant',
        content: response.content,
        metadata: {
          responseTime,
          provider,
          tokens: response.tokens,
          contextItems: contextItems || []
        }
      });

      console.log('💾 Chat messages stored in TiDB');
    } catch (dbError) {
      console.error('⚠️ Failed to store chat messages:', dbError);
      // Don't fail the request if database storage fails
    }

    // Store in Mem0 for advanced memory (optional)
    if (process.env.MEM0_API_KEY) {
      try {
        await storeMemory(userId, [
          {
            role: 'user',
            content: [{
              type: 'text',
              text: lastMessage.content
            }]
          }
        ], {
          type: 'custom_chat',
          chatId: chatId,
          timestamp: new Date().toISOString(),
          responseTime,
          provider,
          tokens: response.tokens,
          contextItems: contextItems || []
        });
      } catch (memoryError) {
        console.error('⚠️ Failed to store in Mem0:', memoryError);
      }
    }

    // Log LLM request for analytics
    try {
      await logLLMRequest({
        userId: dbUser.id,
        model: provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-3.5-turbo',
        prompt: lastMessage.content,
        response: response.content,
        metadata: {
          provider,
          inputTokens: Math.ceil(lastMessage.content.length / 4), // Rough estimate
          outputTokens: response.tokens,
          responseTime,
          success: true,
          endpoint: '/api/chat'
        }
      });
    } catch (logError) {
      console.error('⚠️ Failed to log LLM request:', logError);
    }

    // Track AI feature usage
    try {
      await trackAIFeature({
        feature: 'custom_chat',
        performance: responseTime,
        success: true,
        userId: dbUser.id,
        metadata: {
          provider,
          tokens: response.tokens,
          messageLength: lastMessage.content.length,
          contextItems: contextItems?.length || 0
        }
      });
    } catch (trackError) {
      console.error('⚠️ Failed to track AI feature:', trackError);
    }

    return NextResponse.json({
      success: true,
      response: response.content,
      provider,
      tokens: response.tokens,
      responseTime,
      metadata: {
        model: provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-3.5-turbo',
        contextItems: contextItems?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Chat API error:', error);
    
    const responseTime = Date.now() - startTime;
    
    // Track failed AI feature usage
    try {
      const appwriteUser = await getCurrentUser(req);
      if (appwriteUser) {
        const dbUser = await userService.getByAppwriteUserId(appwriteUser.$id);
        if (dbUser) {
          await trackAIFeature({
            feature: 'custom_chat',
            performance: responseTime,
            success: false,
            userId: dbUser.id,
            metadata: {
              error: error.message
            }
          });
        }
      }
    } catch (trackError) {
      console.error('⚠️ Failed to track failed AI feature:', trackError);
    }

    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  try {
    const groqConfigured = !!process.env.GROQ_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      status: 'healthy',
      services: {
        groq: groqConfigured,
        openai: openaiConfigured
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
