"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Loader2, Plus, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Classroom = {
  id: string; name: string; subject?: string; description?: string; role: "teacher" | "student";
  student_count: number; assignment_count: number;
};

export default function ClassroomsPage() {
  const { getAuthenticatedFetch } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getAuthenticatedFetch()("/api/classrooms");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setClassrooms(data.classrooms);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load classrooms"); }
    finally { setLoading(false); }
  }, [getAuthenticatedFetch]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("join") || "";
    if (code) { setJoinCode(code); setJoinOpen(true); }
  }, []);

  const createClassroom = async (formData: FormData) => {
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()("/api/classrooms", { method: "POST", body: JSON.stringify({ name: formData.get("name"), subject: formData.get("subject"), description: formData.get("description") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCreateOpen(false); toast.success("Classroom created"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create classroom"); }
    finally { setBusy(false); }
  };

  const joinClassroom = async (formData: FormData) => {
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()("/api/classrooms/join", { method: "POST", body: JSON.stringify({ code: formData.get("code") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setJoinOpen(false); toast.success("You joined the classroom"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not join classroom"); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-bold tracking-tight">Classrooms</h1><p className="mt-1 text-muted-foreground">Teach, learn, submit work, and review progress in one place.</p></div>
        <div className="flex gap-2">
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}><DialogTrigger asChild><Button variant="outline">Join with code</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Join a classroom</DialogTitle><DialogDescription>Enter the invite code shared by your teacher.</DialogDescription></DialogHeader><form action={joinClassroom} className="space-y-4"><div className="space-y-2"><Label htmlFor="code">Invite code</Label><Input id="code" name="code" required minLength={6} autoComplete="off" className="uppercase" defaultValue={joinCode} /></div><Button disabled={busy} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Join classroom</Button></form></DialogContent></Dialog>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Create classroom</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create a classroom</DialogTitle><DialogDescription>You will become the classroom owner and teacher.</DialogDescription></DialogHeader><form action={createClassroom} className="space-y-4"><div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" name="name" required minLength={2} /></div><div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" name="subject" /></div><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div><Button disabled={busy} className="w-full">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button></form></DialogContent></Dialog>
        </div>
      </div>

      {loading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : classrooms.length === 0 ? (
        <Card className="border-dashed"><CardContent className="flex min-h-72 flex-col items-center justify-center text-center"><GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" /><h2 className="text-lg font-semibold">No classrooms yet</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Create a classroom to teach, or join one using an invite code.</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{classrooms.map((classroom) => (
          <Link key={classroom.id} href={`/dashboard/classrooms/${classroom.id}`} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50"><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{classroom.name}</CardTitle><CardDescription className="mt-1">{classroom.subject || "General"}</CardDescription></div><Badge variant={classroom.role === "teacher" ? "default" : "secondary"}>{classroom.role}</Badge></div></CardHeader><CardContent><p className="mb-5 line-clamp-2 min-h-10 text-sm text-muted-foreground">{classroom.description || "No description"}</p><div className="flex items-center gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{classroom.student_count} students</span><span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{classroom.assignment_count} homework</span></div></CardContent></Card>
          </Link>
        ))}</div>
      )}
    </div>
  );
}
