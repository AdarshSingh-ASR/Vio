"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, Check, ChevronDown, Copy, FileText, Loader2, Plus, Send, Trash2, User, X, XCircle } from "lucide-react";
import { Streamdown } from "streamdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { getValidJWT } from "@/lib/appwrite-client";
import { cn } from "@/lib/utils";
import vioLogo from "@/assets/images/vio.svg";

type ToolEvent = { type: "started" | "completed"; tool: string; detail?: string };
type Citation = { label: string; title?: string; locator?: unknown; sourceType?: string };
type Approval = { runId: string; tool: string; arguments?: Record<string, unknown> };
type ChatMessage = { id: string; role: "user" | "assistant"; content: string; timestamp: Date; provider?: string; toolEvents?: ToolEvent[]; citations?: Citation[]; approval?: Approval; failed?: boolean };
type DashboardItem = { id?: string; $id?: string; displayName?: string; title?: string; fileType?: string };

const quickActions = [
  { label: "Summarize", prompt: "Summarize the selected material with the key ideas and important details." },
  { label: "Flashcards", prompt: "Create concise question-and-answer flashcards from the selected material." },
  { label: "Study plan", prompt: "Create a practical study plan based on my material and current learning goals." },
];

const Bot = ({ className }: { className?: string }) => <Image src={vioLogo} alt="Vio" width={15} height={15} className={cn("h-[15px] w-[15px]", className)} />;

export default function CustomChatSidebar({ onClose }: { onClose: () => void }) {
  const { getAuthenticatedFetch, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const chatId = user?.id ? `vio-chat-${user.id}` : "vio-chat-session";

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const loadHistory = useCallback(async (before?: string) => {
      try {
        const jwt = await getValidJWT();
        const response = await fetch("/api/chat/history", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt || ""}` }, body: JSON.stringify({ chatId, limit: 50, before }) });
        if (response.ok) {
          const data = await response.json();
          const loaded = (data.messages || []).filter((message: any) => message.role === "user" || message.role === "assistant").map((message: any) => ({ id: message.id, role: message.role, content: message.content, timestamp: new Date(message.createdAt), provider: message.metadata?.provider, failed: message.metadata?.status === "failed" }));
          setMessages((current) => before ? [...loaded, ...current] : loaded);
          setHistoryCursor(data.nextCursor || null);
          setHasMoreHistory(Boolean(data.hasMore));
        }
      } finally { setHistoryLoading(false); }
  }, [chatId]);
  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const loadItems = async () => {
      try { const response = await getAuthenticatedFetch()("/api/dashboard/items?workspaceId=default"); const data = await response.json(); if (response.ok) setItems(data.items || []); } catch { /* optional context */ }
    };
    void loadItems();
  }, [getAuthenticatedFetch]);

  const updateAssistant = (id: string, update: (message: ChatMessage) => ChatMessage) => setMessages((current) => current.map((message) => message.id === id ? update(message) : message));

  const send = useCallback(async (raw: string) => {
    const content = raw.trim();
    if (!content || loading) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() };
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);
    setInput(""); setLoading(true); setError(null); setRetryPrompt(null);
    abortRef.current = new AbortController();
    let activeRunId: string | null = null;
    try {
      const jwt = await getValidJWT();
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt || ""}` }, body: JSON.stringify({ message: content, chatId, contextItemIds: selectedItems }), signal: abortRef.current.signal });
      activeRunId = response.headers.get("X-Agent-Run-Id");
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "The AI service is unavailable"); }
      if (!response.body) throw new Error("Streaming response was unavailable");
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const packets = buffer.split("\n\n"); buffer = packets.pop() || "";
        for (const packet of packets) {
          const line = packet.split("\n").find((part) => part.startsWith("data:")); if (!line) continue;
          const event = JSON.parse(line.slice(5).trim());
          if (event.type === "message.delta") updateAssistant(assistantId, (message) => ({ ...message, content: message.content + (event.delta || "") }));
          if (event.type === "tool.started") updateAssistant(assistantId, (message) => ({ ...message, toolEvents: [...(message.toolEvents || []), { type: "started", tool: event.tool }] }));
          if (event.type === "tool.completed") updateAssistant(assistantId, (message) => ({ ...message, toolEvents: [...(message.toolEvents || []).filter((item) => !(item.tool === event.tool && item.type === "started")), { type: "completed", tool: event.tool }] }));
          if (event.type === "citation") updateAssistant(assistantId, (message) => ({ ...message, citations: [...(message.citations || []), { label: event.label, title: event.title, locator: event.locator, sourceType: event.sourceType }] }));
          if (event.type === "approval.required") updateAssistant(assistantId, (message) => ({ ...message, approval: { runId: event.runId, tool: event.requirements?.[0]?.tool || "sensitive action", arguments: event.requirements?.[0]?.arguments } }));
          if (event.type === "done") updateAssistant(assistantId, (message) => ({ ...message, provider: event.provider || "vertex" }));
          if (event.type === "error") throw new Error(event.message || "The agent run failed");
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not complete the request";
      if (activeRunId && message !== "The user aborted a request.") {
        try {
          const jwt = await getValidJWT();
          const replay = await fetch(`/api/chat/runs/${activeRunId}/events`, { headers: { Authorization: `Bearer ${jwt || ""}` } });
          if (replay.ok) {
            const run = await replay.json();
            const approvalEvent = [...(run.events || [])].reverse().find((event: any) => event.event_type === "approval.required");
            if (run.status === "awaiting_approval" && approvalEvent) {
              const requirement = approvalEvent.payload?.requirements?.[0];
              updateAssistant(assistantId, (item) => ({ ...item, failed: false, approval: { runId: activeRunId!, tool: requirement?.tool || "sensitive action", arguments: requirement?.arguments }, content: item.content || "This action needs your confirmation." }));
              return;
            }
            if (run.status === "completed") { await loadHistory(); return; }
          }
        } catch { /* normal retry UI below */ }
      }
      if (message !== "The user aborted a request.") setError(message);
      if (message !== "The user aborted a request.") setRetryPrompt(content);
      updateAssistant(assistantId, (item) => ({ ...item, failed: true, content: item.content || "I could not complete that request. You can retry safely." }));
    } finally { setLoading(false); abortRef.current = null; }
  }, [chatId, loading, selectedItems, loadHistory]);

  const decideApproval = async (messageId: string, approval: Approval, approved: boolean) => {
    try {
      const jwt = await getValidJWT();
      const response = await fetch(`/api/chat/runs/${approval.runId}/continue`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt || ""}` }, body: JSON.stringify({ approved }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not resume the run");
      updateAssistant(messageId, (message) => ({ ...message, approval: data.paused ? { runId: data.runId, tool: data.requirements?.[0]?.tool || "sensitive action", arguments: data.requirements?.[0]?.arguments } : undefined, content: `${message.content}\n\n${approved ? data.content || (data.paused ? "Another confirmation is required." : "Action approved and completed.") : "Action declined."}` }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not resume the run"); }
  };

  const clear = async () => {
    if (!confirm("Clear this conversation?")) return;
    const jwt = await getValidJWT(); await fetch("/api/chat/clear", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt || ""}` }, body: JSON.stringify({ chatId }) }); setMessages([]);
  };

  const startNewChat = async () => {
    const jwt = await getValidJWT();
    await fetch("/api/chat/clear", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt || ""}` }, body: JSON.stringify({ chatId }) });
    setMessages([]); setInput(""); setError(null); setRetryPrompt(null); setSelectedItems([]); setShowFiles(false);
  };

  if (historyLoading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return <div className="relative flex h-full min-h-0 flex-col bg-background">
    {hasMoreHistory && historyCursor && <Button variant="secondary" size="sm" className="absolute left-1/2 top-12 z-20 -translate-x-1/2 shadow" onClick={() => void loadHistory(historyCursor)}>Load earlier</Button>}
    <div className="flex items-center justify-between border-b bg-background/95 px-4 py-2.5 backdrop-blur"><Image src={vioLogo} alt="Vio" width={48} height={24} /><div className="flex items-center gap-1"><Button variant="ghost" size="sm" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => void startNewChat()}><Plus className="mr-1 h-3.5 w-3.5" />New chat</Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={() => void clear()} title="Delete conversation"><Trash2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground" onClick={onClose} title="Close chat"><X className="h-4 w-4" /></Button></div></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 p-3">{messages.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-3"><Brain className="h-6 w-6 text-primary" /></div><h2 className="font-semibold">What are you learning?</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask about your files, plan study work, or manage a classroom with transparent tool calls.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{quickActions.map((action) => <Button key={action.label} variant="outline" size="sm" onClick={() => setInput(action.prompt)}>{action.label}</Button>)}</div></div> : messages.map((message) => <div key={message.id} className={cn("flex gap-2.5", message.role === "user" && "flex-row-reverse")}><div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")} >{message.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}</div><div className={cn("min-w-0 max-w-[88%]", message.role === "user" && "text-right")}><div className={cn("rounded-2xl px-3 py-2 text-left text-sm", message.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border bg-card", message.failed && "border-destructive/40")}>
      {message.role === "assistant" ? <Streamdown mode={loading && message.id === messages[messages.length - 1]?.id ? "streaming" : "static"} className="prose prose-sm max-w-none dark:prose-invert" controls={{ code: true, table: true }} linkSafety={{ enabled: true }}>{message.content}</Streamdown> : <p className="whitespace-pre-wrap">{message.content}</p>}
      {message.toolEvents?.length ? <div className="mt-3 space-y-1 border-t pt-2">{message.toolEvents.map((event, index) => <div key={`${event.tool}-${index}`} className="flex items-center gap-2 text-[11px] text-muted-foreground">{event.type === "completed" ? <Check className="h-3 w-3 text-emerald-500" /> : <Loader2 className="h-3 w-3 animate-spin" />} {event.type === "completed" ? "Used" : "Using"} {event.tool}</div>)}</div> : null}
      {message.citations?.length ? <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2">{message.citations.map((citation, index) => <Badge key={`${citation.label}-${index}`} variant="outline" title={citation.title || citation.label}>{citation.label}{citation.title ? ` · ${citation.title}` : ""}</Badge>)}</div> : null}
      {message.approval ? <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs font-medium">Confirm sensitive action</p><p className="mt-1 text-xs text-muted-foreground">The agent wants to run <strong>{message.approval.tool}</strong>.</p>{message.approval.arguments && <pre className="mt-2 max-h-32 overflow-auto rounded bg-background/70 p-2 text-[10px]">{JSON.stringify(message.approval.arguments, null, 2)}</pre>}<div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void decideApproval(message.id, message.approval!, true)}>Approve</Button><Button size="sm" variant="outline" onClick={() => void decideApproval(message.id, message.approval!, false)}>Decline</Button></div></div> : null}
      </div><div className="mt-1 flex items-center gap-2 px-1 text-[10px] text-muted-foreground">{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{message.provider && <Badge variant="outline" className="h-4 px-1 text-[9px]">{message.provider}</Badge>}{message.role === "assistant" && message.content && <button onClick={() => void navigator.clipboard.writeText(message.content)} title="Copy response"><Copy className="h-3 w-3" /></button>}</div></div></div>)}{loading && !messages[messages.length - 1]?.content ? <div className="flex items-center gap-2 px-10 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Thinking and selecting tools…</div> : null}<div ref={endRef} /></div></ScrollArea>
    <div aria-live="polite" className="sr-only">{loading ? "Vio is generating a response" : error || ""}</div>
    {error && <div className="mx-3 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive"><XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="flex-1">{error}</span>{retryPrompt && <Button size="sm" variant="outline" className="h-6" onClick={() => void send(retryPrompt)}>Retry</Button>}<button onClick={() => setError(null)}><X className="h-3.5 w-3.5" /></button></div>}
    {showFiles && <div className="border-t bg-muted/20 p-2"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-medium">Reference saved files</p><button onClick={() => setShowFiles(false)}><ChevronDown className="h-4 w-4" /></button></div><ScrollArea className="max-h-32"><div className="space-y-1">{items.length ? items.map((item) => { const itemId = item.id || item.$id || ""; const selected = selectedItems.includes(itemId); return <button key={itemId} onClick={() => setSelectedItems((current) => selected ? current.filter((id) => id !== itemId) : [...current, itemId])} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted", selected && "bg-primary/10 text-primary")}><FileText className="h-3.5 w-3.5" /><span className="flex-1 truncate">{item.displayName || item.title || "Untitled"}</span>{selected && <Check className="h-3.5 w-3.5" />}</button>; }) : <p className="py-3 text-center text-xs text-muted-foreground">No saved files</p>}</div></ScrollArea></div>}
    <div className="border-t p-2"><div className="mb-2 flex gap-1 overflow-x-auto">{quickActions.map((action) => <Button key={action.label} variant="ghost" size="sm" className="h-7 shrink-0 text-[11px]" onClick={() => setInput(action.prompt)}>{action.label}</Button>)}</div><div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 focus-within:ring-1 focus-within:ring-ring"><Button variant={selectedItems.length ? "secondary" : "ghost"} size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowFiles((value) => !value)} title="Add file context"><Plus className="h-4 w-4" /></Button><Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }} placeholder="Ask Vio…" className="max-h-28 min-h-8 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0" rows={1} />{loading ? <Button size="icon" variant="destructive" className="h-8 w-8 shrink-0" onClick={() => abortRef.current?.abort()}><X className="h-4 w-4" /></Button> : <Button size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim()} onClick={() => void send(input)}><Send className="h-4 w-4" /></Button>}</div><p className="mt-1.5 text-center text-[10px] text-muted-foreground">AI can make mistakes. Sensitive actions require confirmation.</p></div>
  </div>;
}
