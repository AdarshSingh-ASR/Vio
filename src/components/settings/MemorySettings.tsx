"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

type Memory = { id: string; content: string; scope_type: string; confidence: number; updated_at: string };

export default function MemorySettings() {
  const { getAuthenticatedFetch } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await getAuthenticatedFetch()("/api/ai/memories");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMemories(data.memories || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load memories"); }
    finally { setLoading(false); }
  }, [getAuthenticatedFetch]);
  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    setDeleting(id);
    try {
      const response = await getAuthenticatedFetch()("/api/ai/memories", { method: "DELETE", body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setMemories((current) => current.filter((memory) => memory.id !== id));
      toast.success("Memory deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete memory"); }
    finally { setDeleting(null); }
  };

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />AI memory</CardTitle><CardDescription>Review durable facts Vio may use across conversations. Conversation history and classroom records are managed separately.</CardDescription></CardHeader><CardContent className="space-y-3">{loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : memories.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No curated memories stored.</p> : memories.map((memory) => <div key={memory.id} className="flex items-start justify-between gap-4 rounded-lg border p-4"><div><p className="whitespace-pre-wrap text-sm">{memory.content}</p><p className="mt-2 text-xs text-muted-foreground">{memory.scope_type} · confidence {Math.round(Number(memory.confidence) * 100)}%</p></div><Button size="icon" variant="ghost" aria-label="Delete memory" disabled={deleting === memory.id} onClick={() => void remove(memory.id)}>{deleting === memory.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>)}</CardContent></Card>;
}
