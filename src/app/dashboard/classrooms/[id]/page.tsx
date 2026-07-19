"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, CalendarDays, ClipboardList, Copy, Loader2, Plus, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadClassroomFilesDirect } from "@/lib/classroom-upload-client";

type Classroom = any;

export default function ClassroomPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const { getAuthenticatedFetch } = useAuth();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}`);
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setClassroom(data.classroom);
      if (data.classroom.role === "teacher") {
        const inviteResponse = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/invites`);
        if (inviteResponse.ok) setInvites((await inviteResponse.json()).invites || []);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load classroom"); }
    finally { setLoading(false); }
  }, [getAuthenticatedFetch, params.id]);
  useEffect(() => { void load(); }, [load]);

  const createInvite = async () => {
    setBusy(true);
    try { const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/invites`, { method: "POST", body: JSON.stringify({ expiresInDays: 7, maxUses: 50 }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setInvite(data.invite); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not create invite"); } finally { setBusy(false); }
  };

  const removeMember = async (userId: string) => {
    if (!window.confirm("Remove this student from the classroom? Their existing submissions are retained.")) return;
    const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/members/${userId}`, { method: "DELETE" });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not remove member"); toast.success("Member removed"); await load();
  };

  const revokeInvite = async (inviteId: string) => {
    const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/invites/${inviteId}`, { method: "DELETE" });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not revoke invite"); toast.success("Invite revoked"); await load();
  };

  const archiveClassroom = async () => {
    if (!window.confirm("Archive this classroom? Members will no longer see it in their active list.")) return;
    const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}`, { method: "DELETE" });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not archive classroom"); window.location.href = "/dashboard/classrooms";
  };

  const createAssignment = async (formData: FormData) => {
    setBusy(true);
    try {
      const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/assignments`, { method: "POST", body: JSON.stringify({
        title: formData.get("title"), lessonNumber: formData.get("lessonNumber") || undefined, chapterNumber: formData.get("chapterNumber") || undefined,
        chapterName: formData.get("chapterName") || undefined, instructions: formData.get("instructions"), dueAt: new Date(String(formData.get("dueAt"))).toISOString(),
        maxMarks: Number(formData.get("maxMarks") || 100), allowLate: formData.get("allowLate") === "on", allowResubmission: formData.get("allowResubmission") === "on", status: formData.get("publish") === "on" ? "published" : "draft",
      }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const attachments = formData.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      if (attachments.length) {
        const storedFiles = await uploadClassroomFilesDirect(attachments, (completed, total, current) => setUploadProgress(Math.round(((completed + current / 100) / total) * 100)));
        const uploadResponse = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/assignments/${data.assignment.id}/attachments`, { method: "POST", body: JSON.stringify({ storedFiles: storedFiles.map(({ fileId, bucketId }) => ({ fileId, bucketId })) }) });
        if (!uploadResponse.ok) { const uploadData = await uploadResponse.json(); throw new Error(uploadData.error || "Homework was created, but an attachment failed to upload"); }
      }
      setAssignmentOpen(false); toast.success("Homework created"); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create homework"); } finally { setBusy(false); setUploadProgress(null); }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!classroom) return null;
  const teacher = classroom.role === "teacher";

  return (
    <div className="mx-auto max-w-6xl space-y-7 p-6 md:p-10">
      <Link href="/dashboard/classrooms" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" />All classrooms</Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex items-center gap-2"><Badge>{classroom.role}</Badge>{classroom.subject && <Badge variant="outline">{classroom.subject}</Badge>}</div><h1 className="text-3xl font-bold">{classroom.name}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{classroom.description || "No description"}</p></div>{teacher && <div className="flex flex-wrap gap-2"><Button variant="ghost" size="icon" aria-label="Archive classroom" onClick={archiveClassroom}><Archive className="h-4 w-4" /></Button><Dialog><DialogTrigger asChild><Button variant="outline"><Users className="mr-2 h-4 w-4" />Invite</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Invite students</DialogTitle><DialogDescription>Codes expire after seven days and can be revoked below.</DialogDescription></DialogHeader>{invite ? <div className="space-y-3"><div className="rounded-lg border bg-muted/40 p-5 text-center font-mono text-2xl font-semibold tracking-[0.25em]">{invite.code}</div><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(invite.code); toast.success("Code copied"); }}><Copy className="mr-2 h-4 w-4" />Copy code</Button><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(invite.link); toast.success("Link copied"); }}><Copy className="mr-2 h-4 w-4" />Copy link</Button></div></div> : <Button onClick={createInvite} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate invite code</Button>}<div className="space-y-2 border-t pt-4">{invites.filter((item) => !item.revoked_at).map((item) => <div key={item.id} className="flex items-center justify-between rounded-md border p-2 text-sm"><span>••••{item.code_hint} · {item.use_count}/{item.max_uses} uses</span><Button size="sm" variant="ghost" onClick={() => void revokeInvite(item.id)}>Revoke</Button></div>)}</div></DialogContent></Dialog>
      <Dialog open={assignmentOpen} onOpenChange={setAssignmentOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />New homework</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Create homework</DialogTitle><DialogDescription>AI feedback stays private until you review and publish the result.</DialogDescription></DialogHeader><form action={createAssignment} className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Title</Label><Input name="title" required /></div><div className="space-y-2"><Label>Lesson number</Label><Input name="lessonNumber" /></div><div className="space-y-2"><Label>Chapter number</Label><Input name="chapterNumber" /></div><div className="space-y-2 sm:col-span-2"><Label>Chapter name</Label><Input name="chapterName" /></div><div className="space-y-2 sm:col-span-2"><Label>Instructions</Label><Textarea name="instructions" required className="min-h-28" /></div><div className="space-y-2"><Label>Due date</Label><Input name="dueAt" type="datetime-local" required /></div><div className="space-y-2"><Label>Maximum marks</Label><Input name="maxMarks" type="number" min="1" defaultValue="100" required /></div><div className="space-y-2 sm:col-span-2"><Label>Attachments <span className="font-normal text-muted-foreground">(optional, 20 MB each)</span></Label><Input name="attachments" type="file" multiple accept=".pdf,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.mp4,.webm,.mov" />{uploadProgress != null && <p className="text-xs text-muted-foreground" aria-live="polite">Uploading to secure storage: {uploadProgress}%</p>}</div><label className="flex items-center justify-between rounded-lg border p-3 text-sm">Allow late submissions<Switch name="allowLate" /></label><label className="flex items-center justify-between rounded-lg border p-3 text-sm">Allow resubmissions<Switch name="allowResubmission" defaultChecked /></label><label className="flex items-center justify-between rounded-lg border p-3 text-sm sm:col-span-2">Publish immediately<Switch name="publish" /></label><Button className="sm:col-span-2" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create homework</Button></form></DialogContent></Dialog></div>}</div>

      <Tabs defaultValue="homework"><TabsList><TabsTrigger value="homework">Homework</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger></TabsList><TabsContent value="homework" className="mt-5"><div className="grid gap-4 md:grid-cols-2">{classroom.assignments.length === 0 ? <Card className="border-dashed md:col-span-2"><CardContent className="flex min-h-56 flex-col items-center justify-center text-center"><ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" /><h2 className="font-semibold">No homework yet</h2><p className="text-sm text-muted-foreground">{teacher ? "Create the first assignment for this classroom." : "Your teacher has not published any homework."}</p></CardContent></Card> : classroom.assignments.map((assignment: any) => <Link key={assignment.id} href={`/dashboard/classrooms/${params.id}/assignments/${assignment.id}`}><Card className="h-full transition-colors hover:border-primary/50"><CardHeader><div className="flex items-start justify-between gap-3"><CardTitle className="text-lg">{assignment.title}</CardTitle><Badge variant={assignment.status === "published" ? "default" : "secondary"}>{assignment.status}</Badge></div><CardDescription>{assignment.chapter_name || "General lesson"}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="line-clamp-2 text-sm text-muted-foreground">{assignment.instructions}</p><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{format(new Date(assignment.due_at), "PPp")}</span>{teacher ? <span>{assignment.submission_count} submissions</span> : <span>{assignment.my_submission_status || "Not submitted"}</span>}</div></CardContent></Card></Link>)}</div></TabsContent>
      <TabsContent value="members" className="mt-5"><Card><CardHeader><CardTitle>Class members</CardTitle><CardDescription>{classroom.members.length} active members</CardDescription></CardHeader><CardContent className="divide-y">{classroom.members.map((member: any) => <div key={member.user_id} className="flex items-center justify-between py-3"><div><p className="font-medium">{[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email}</p><p className="text-xs text-muted-foreground">{member.email}</p></div><div className="flex items-center gap-2"><Badge variant="outline">{member.role}</Badge>{teacher && member.role === "student" && <Button size="icon" variant="ghost" aria-label={`Remove ${member.email}`} onClick={() => void removeMember(member.user_id)}><Trash2 className="h-4 w-4" /></Button>}</div></div>)}</CardContent></Card></TabsContent></Tabs>
    </div>
  );
}
