"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  Plus, 
  FileText, 
  Lightbulb, 
  Mail,
  BookOpen,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  MessageSquare,
  Zap,
  Settings
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { storeMemory, retrieveMemoriesForUser } from "@/lib/mem0";
import { logLLMRequest, trackAIFeature } from "@/lib/keywords-ai";
import { getValidJWT } from "@/lib/appwrite-client";
import ReactMarkdown from 'react-markdown';

// Define types
type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    responseTime?: number;
    provider?: 'groq' | 'openai';
    tokens?: number;
    contextItems?: string[];
  };
};

type DashboardItem = {
  $id?: string;
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  extractedContent?: string;
  fileType?: string;
};

type ChatFeature = {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  prompt: string;
};

// Helper function to get the correct ID from an item
const getItemId = (item: DashboardItem): string => {
  return item.$id || item.id || '';
};

// Available chat features
const chatFeatures: ChatFeature[] = [
  {
    id: 'flashcards',
    name: 'Flash Cards',
    icon: <BookOpen className="w-4 h-4" />,
    description: 'Generate study flashcards from content',
    prompt: 'Generate flashcards from the provided content. Create question-answer pairs that cover the key concepts, facts, and important details.'
  },
  {
    id: 'summary',
    name: 'Summary',
    icon: <FileText className="w-4 h-4" />,
    description: 'Create concise summaries',
    prompt: 'Provide a comprehensive summary of the provided content. Include the main points, key insights, and important details in a clear and organized manner.'
  },
  {
    id: 'insights',
    name: 'Insights',
    icon: <Lightbulb className="w-4 h-4" />,
    description: 'Extract key insights and analysis',
    prompt: 'Analyze the provided content and extract key insights, patterns, and actionable takeaways. Provide critical analysis and recommendations.'
  },
  {
    id: 'email',
    name: 'Email Writer',
    icon: <Mail className="w-4 h-4" />,
    description: 'Help write professional emails',
    prompt: 'Help me write a professional email based on the provided context. Ensure proper tone, structure, and clarity for the intended recipient.'
  }
];

const CustomChatSidebar: React.FC = () => {
  const { getAuthenticatedFetch, user } = useAuth();
  
  // State management
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextItems, setContextItems] = useState<DashboardItem[]>([]);
  const [selectedContext, setSelectedContext] = useState<string[]>([]);
  const [showContext, setShowContext] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Create a consistent chat ID
  const chatId = user?.id ? `vio-chat-${user.id}` : 'vio-chat-session';

  // Scroll to bottom when new messages are added
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load chat history on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setIsLoadingHistory(true);
        const response = await fetch('/api/chat/history', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getValidJWT() || ''}`
          },
          body: JSON.stringify({ userId: user?.id || 'session', chatId })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            const formattedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
              id: msg.id || `msg-${Date.now()}-${Math.random()}`,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.createdAt || Date.now()),
              metadata: msg.metadata
            }));
            setMessages(formattedMessages);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();
  }, [chatId, user?.id]);

  // Fetch context items
  useEffect(() => {
    const fetchContextItems = async () => {
      try {
        const authenticatedFetch = getAuthenticatedFetch();
        const response = await authenticatedFetch('/api/dashboard/items?workspaceId=default');
        
        if (response.ok) {
          const data = await response.json();
          if (data?.items && Array.isArray(data.items)) {
            setContextItems(data.items);
          }
        }
      } catch (error) {
        console.error('Failed to fetch context items:', error);
      }
    };

    fetchContextItems();
  }, [getAuthenticatedFetch]);

  // Handle sending messages
  const sendMessage = useCallback(async (content: string, featurePrompt?: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      const startTime = Date.now();
      
      // Prepare context
      const contextInfo = selectedContext.length > 0 
        ? selectedContext.map(id => {
            const item = contextItems.find(item => getItemId(item) === id);
            if (!item) return '';
            return `📄 ${item.displayName || item.name}:\n${item.extractedContent?.substring(0, 1000) || 'No content available'}...`;
          }).filter(Boolean).join('\n\n')
        : '';

      // Prepare system prompt
      const systemPrompt = `You are a helpful AI assistant powered by Groq Llama3 with OpenAI fallback. Help users with:
- Generate flashcards from content
- Create summaries and insights
- Help with writing tasks (emails, reports, documents, etc.)
- Answer questions about saved materials
- Provide contextual assistance

${featurePrompt ? `\nSPECIFIC TASK: ${featurePrompt}` : ''}

${contextInfo ? `\nRELEVANT CONTEXT FROM USER'S SAVED CONTENT:\n${contextInfo}` : ''}

Be concise but comprehensive. Use the provided context to give accurate answers. Reference specific saved items when relevant.`;

      // Send to our custom API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getValidJWT() || ''}`
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: content.trim() }
          ],
          userId: user?.id || 'anonymous',
          chatId: chatId,
          contextItems: selectedContext
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const responseTime = Date.now() - startTime;

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date(),
        metadata: {
          responseTime,
          provider: data.provider || 'unknown',
          tokens: data.tokens,
          contextItems: selectedContext
        }
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Track AI feature usage
      await trackAIFeature({
        feature: 'custom_chat',
        performance: responseTime,
        success: true,
        userId: user?.id || 'anonymous',
        metadata: {
          messageLength: content.length,
          contextItems: selectedContext.length,
          provider: data.provider
        }
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        metadata: { provider: undefined }
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedContext, contextItems, chatId, user?.id, getAuthenticatedFetch]);

  // Auto-resize textarea helper function
  const resizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const minHeight = 36;
    const maxHeight = 120;
    
    // Set height within bounds
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  // Handle feature selection
  const handleFeatureSelect = (feature: ChatFeature) => {
    const prompt = feature.prompt;
    if (selectedContext.length === 0) {
      setInputValue(prompt + ' ');
    } else {
      setInputValue(prompt + ' Please use the selected context items to help with this task. ');
    }
    setShowFeatures(false);
    
    // Focus and resize textarea after state update
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        resizeTextarea(textareaRef.current);
      }
    }, 0);
  };

  // Handle input key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  // Auto-resize textarea based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    resizeTextarea(e.target);
  };

  // Reset textarea height when input is cleared and resize when value changes
  useEffect(() => {
    if (textareaRef.current) {
      if (inputValue === '') {
        textareaRef.current.style.height = '36px';
      } else {
        // Resize when input value changes programmatically
        resizeTextarea(textareaRef.current);
      }
    }
  }, [inputValue]);

  // Clear chat history
  const clearChatHistory = async () => {
    if (confirm('Clear all chat history? This action cannot be undone.')) {
      try {
        await fetch('/api/chat/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user?.id || 'session', chatId })
        });
        setMessages([]);
      } catch (error) {
        console.error('Failed to clear chat history:', error);
      }
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Loading state
  if (isLoadingHistory) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading chat history...</p>
      </div>
    );
  }

  return (
    <div className="minimal-chat-sidebar">

      {/* Messages Container */}
      <ScrollArea className="minimal-chat-messages">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="ultra-minimal-empty-state">
              <div className="ultra-minimal-icon">
                <Zap className="w-4 h-4 text-muted-foreground" />
              </div>
              <h3 className="ultra-minimal-title">Start a new conversation</h3>
              <p className="ultra-minimal-description">
                Ask me anything, generate flashcards, summarize content, write emails, and more.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`minimal-chat-message-group ${message.role === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="minimal-chat-message-avatar">
                  {message.role === 'user' ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                      <User className="w-3 h-3 text-primary-foreground" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center">
                      <Brain className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="minimal-chat-message-content">
                  <div className="minimal-chat-message-bubble">
                    <div className="minimal-chat-message-text">
                      {message.role === 'assistant' ? (
                        <ReactMarkdown 
                          className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-pre:text-foreground"
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="text-xs">{children}</li>,
                            code: ({ children, className }) => {
                              const isInline = !className?.includes('language-');
                              if (isInline) {
                                return <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
                              }
                              return (
                                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                                  <code>{children}</code>
                                </pre>
                              );
                            },
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-muted-foreground pl-2 italic text-xs mb-2">
                                {children}
                              </blockquote>
                            ),
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        message.content
                      )}
                    </div>
                    
                    {/* Message metadata */}
                    {message.metadata && (
                      <div className="minimal-chat-message-metadata">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {message.metadata.responseTime}ms
                          </span>
                          {message.metadata.provider && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                              {message.metadata.provider}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="minimal-chat-timestamp">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="minimal-chat-message-group assistant">
              <div className="minimal-chat-message-avatar">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center">
                  <Brain className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              <div className="minimal-chat-message-content">
                <div className="minimal-chat-typing">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Error display */}
      {error && (
        <div className="px-3 py-1">
          <div className="minimal-chat-error">
            <XCircle className="w-3 h-3 text-destructive" />
            <span className="text-xs text-destructive">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-destructive/70 hover:text-destructive p-0.5 rounded"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Context Selection */}
      {showContext && (
        <div className="px-2 py-1 border-t border-border/20">
          <div className="minimal-context-panel-compact">
            <div className="minimal-context-header-compact">
              <div>
                <div className="font-medium text-xs">Select context</div>
                <div className="text-xs text-muted-foreground">Choose saved items to reference</div>
              </div>
              <button
                onClick={() => setShowContext(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                ×
              </button>
            </div>
            <ScrollArea className="max-h-16 overflow-y-auto">
              <div className="p-1 space-y-0.5">
                {contextItems.length === 0 ? (
                  <div className="p-1.5 text-center text-xs text-muted-foreground">
                    No saved items found
                  </div>
                ) : (
                  contextItems.map(item => (
                    <button
                      key={getItemId(item)}
                      className={`minimal-context-item-compact ${
                        selectedContext.includes(getItemId(item))
                          ? 'selected'
                          : ''
                      }`}
                      onClick={() => {
                        setSelectedContext(prev =>
                          prev.includes(getItemId(item))
                            ? prev.filter(id => id !== getItemId(item))
                            : [...prev, getItemId(item)]
                        );
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate text-xs">{item.displayName || item.name || 'Item'}</span>
                        {selectedContext.includes(getItemId(item)) && (
                          <CheckCircle className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Features Panel */}
      {showFeatures && (
        <div className="px-3 py-2 border-t border-border/30">
          <div className="minimal-features-panel">
            <div className="minimal-features-header">
              <div className="font-medium text-xs">AI Features</div>
              <button
                onClick={() => setShowFeatures(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                ×
              </button>
            </div>
            <div className="p-2 grid grid-cols-2 gap-2">
              {chatFeatures.map(feature => (
                <button
                  key={feature.id}
                  onClick={() => handleFeatureSelect(feature)}
                  className="minimal-feature-item"
                >
                  <div className="minimal-feature-icon">
                    {feature.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-xs">{feature.name}</div>
                    <div className="text-xs text-muted-foreground">{feature.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="minimal-chat-input-area">
        {/* Selected Context Display */}
        {selectedContext.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedContext.map(contextId => {
              const item = contextItems.find(i => getItemId(i) === contextId);
              if (!item) return null;
              return (
                <span
                  key={contextId}
                  className="minimal-context-badge"
                  onClick={() => setSelectedContext(prev => prev.filter(id => id !== contextId))}
                >
                  {item.displayName || item.name || 'Item'} ×
                </span>
              );
            })}
          </div>
        )}

        {/* Compact Action Bar */}
        <div className="ultra-minimal-action-bar">
          <div className="ultra-minimal-feature-buttons">
            {chatFeatures.slice(0, 4).map(feature => (
              <button
                key={feature.id}
                onClick={() => handleFeatureSelect(feature)}
                className="ultra-minimal-feature-btn"
                title={feature.name}
              >
                {feature.icon}
              </button>
            ))}
          </div>
          
          <div className="ultra-minimal-context-section">
            <button
              onClick={() => setShowContext(!showContext)}
              className="ultra-minimal-context-btn"
            >
              <Brain className="w-3 h-3" />
              <span className="text-xs">+ Context</span>
              {selectedContext.length > 0 && (
                <span className="ultra-minimal-badge">{selectedContext.length}</span>
              )}
            </button>
            
            {messages.length > 0 && (
              <button
                onClick={clearChatHistory}
                className="ultra-minimal-clear-btn"
                title="Clear chat"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Input Field */}
        <div className="minimal-chat-input">
          <div className="minimal-input-container">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              className="minimal-chat-textarea"
              disabled={isLoading}
              style={{ height: '36px' }}
            />
            <Button
              size="sm"
              onClick={() => sendMessage(inputValue)}
              disabled={!inputValue.trim() || isLoading}
              className="minimal-send-btn"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomChatSidebar;
