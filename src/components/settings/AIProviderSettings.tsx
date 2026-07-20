"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type Preferences = {
  defaultProvider: "built_in" | "openai_byok";
  allowBuiltInFallback: boolean;
  credentials: { provider: "openai"; lastFour: string; status: string }[];
};

export default function AIProviderSettings() {
  const { getAuthenticatedFetch } = useAuth();
  const [data, setData] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [openAIKey, setOpenAIKey] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await getAuthenticatedFetch()("/api/ai/preferences");
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load AI settings");
    }
  }, [getAuthenticatedFetch]);
  useEffect(() => { void load(); }, [load]);
  const credential = () => data?.credentials.find((item) => item.provider === "openai" && item.status === "active");

  const save = async (next: Partial<Preferences>) => {
    if (!data) return;
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()("/api/ai/preferences", {
        method: "PUT",
        body: JSON.stringify({
          defaultProvider: next.defaultProvider ?? data.defaultProvider,
          allowBuiltInFallback: next.allowBuiltInFallback ?? data.allowBuiltInFallback,
        }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
      toast.success("AI preferences updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update preferences");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()("/api/ai/credentials", {
        method: "POST",
        body: JSON.stringify({ provider: "openai", value: openAIKey }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
      setOpenAIKey("");
      toast.success("OpenAI connected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not connect credential");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()("/api/ai/credentials?provider=openai", { method: "DELETE" });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error);
      setData(value);
      toast.success("Credential revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke credential");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Card><CardContent className="flex min-h-48 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;

  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5" />Default AI provider</CardTitle>
        <CardDescription>Choose who funds summaries, quizzes, research, study workflows, and teacher-owned homework evaluation.</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={data.defaultProvider} onValueChange={(value) => void save({ defaultProvider: value as Preferences["defaultProvider"] })} className="space-y-3">
          <Label className="flex cursor-pointer gap-3 rounded-lg border p-4"><RadioGroupItem value="built_in" /><span><span className="block font-medium">Built-in AI</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Vertex AI Gemini 2.5 Flash with automatic OpenAI and Groq fallback for retryable failures.</span></span></Label>
          <Label className="flex cursor-pointer gap-3 rounded-lg border p-4"><RadioGroupItem value="openai_byok" disabled={!credential()} /><span><span className="block font-medium">OpenAI — your API key</span><span className="mt-1 block text-xs font-normal text-muted-foreground">Uses your Platform API account and usage quota. It does not use a ChatGPT subscription.</span></span></Label>
        </RadioGroup>
        <div className="mt-4 flex items-center justify-between rounded-lg border p-4"><div><p className="text-sm font-medium">Allow built-in fallback</p><p className="text-xs text-muted-foreground">If your own provider is unavailable, allow Vio to use its built-in provider chain.</p></div><Switch checked={data.allowBuiltInFallback} onCheckedChange={(checked) => void save({ allowBuiltInFallback: checked })} /></div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />OpenAI API key</CardTitle><CardDescription>Encrypted with the application encryption key. The key is never returned to this browser.</CardDescription></CardHeader>
      <CardContent>{credential() ? <div className="flex items-center justify-between rounded-lg border p-4"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><div><p className="text-sm font-medium">Connected <Badge variant="outline" className="ml-2">•••• {credential()?.lastFour}</Badge></p><p className="text-xs text-muted-foreground">Validated with OpenAI</p></div></div><Button variant="ghost" size="sm" onClick={() => void revoke()} disabled={busy}><Trash2 className="mr-2 h-4 w-4" />Revoke</Button></div> : <div className="flex gap-2"><Input type="password" value={openAIKey} onChange={(event) => setOpenAIKey(event.target.value)} placeholder="sk-…" autoComplete="off" /><Button disabled={busy || openAIKey.length < 20} onClick={() => void connect()}>Connect</Button></div>}</CardContent>
    </Card>
  </div>;
}
