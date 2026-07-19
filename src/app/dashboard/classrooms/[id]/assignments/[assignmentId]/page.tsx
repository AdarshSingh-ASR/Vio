"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, Clock, History, Loader2, RefreshCw, Send, UserCheck, UsersRound } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { uploadClassroomFilesDirect } from "@/lib/classroom-upload-client";

export default function AssignmentPage(props: { params: Promise<{ id: string; assignmentId: string }> }) {
  const params = use(props.params);
  const { getAuthenticatedFetch } = useAuth();
  const [classroom, setClassroom] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [mySubmission, setMySubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const assignment = useMemo(() => classroom?.assignments?.find((item: any) => item.id === params.assignmentId), [classroom, params.assignmentId]);
  const load = useCallback(async () => {
    try {
      const authFetch = getAuthenticatedFetch();
      const classroomResponse = await authFetch(`/api/classrooms/${params.id}`); const classroomData = await classroomResponse.json(); if (!classroomResponse.ok) throw new Error(classroomData.error); setClassroom(classroomData.classroom);
      const response = await authFetch(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/submissions`); const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (classroomData.classroom.role === "teacher") setSubmissions(data.submissions || []); else setMySubmission(data.submission || null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load homework"); } finally { setLoading(false); }
  }, [getAuthenticatedFetch, params.id, params.assignmentId]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (formData: FormData) => {
    setBusy(true);
    try {
      const files = formData.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
      const storedFiles = await uploadClassroomFilesDirect(files, (completed, total, current) => setUploadProgress(Math.round(((completed + current / 100) / total) * 100)));
      const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/assignments/${params.assignmentId}/submissions`, {
        method: "POST",
        body: JSON.stringify({ textContent: String(formData.get("textContent") || ""), storedFiles: storedFiles.map(({ fileId, bucketId }) => ({ fileId, bucketId })) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(data.evaluationQueued ? "Submitted; AI evaluation has started" : "Submitted; evaluation is waiting for the AI service");
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not submit homework"); } finally { setBusy(false); setUploadProgress(null); }
  };

  const review = async (formData: FormData) => {
    setBusy(true);
    try { const publish = formData.get("action") === "publish"; const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/submissions/${selected.id}/review`, { method: "PUT", body: JSON.stringify({ marks: Number(formData.get("marks")), remarks: formData.get("remarks"), improvements: formData.get("improvements"), overrideReason: formData.get("overrideReason"), publish }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success(publish ? "Result published" : "Review saved"); setSelected(null); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not save review"); } finally { setBusy(false); }
  };

  const openReview = async (submission: any) => {
    setSelected(submission); setVersions([]);
    const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/submissions/${submission.id}`);
    if (response.ok) setVersions((await response.json()).versions || []);
  };

  const recheckAI = async (submissionId: string) => {
    setBusy(true);
    try { const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/submissions/${submissionId}/evaluate`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); toast.success("AI evaluation queued"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not recheck submission"); } finally { setBusy(false); }
  };

  const setAssignmentStatus = async (status: "published" | "closed") => {
    const confirmed = assignment.submission_count > 0 ? window.confirm(`This assignment has submissions. Confirm changing its status to ${status}.`) : true;
    if (!confirmed) return;
    const response = await getAuthenticatedFetch()(`/api/classrooms/${params.id}/assignments/${params.assignmentId}`, { method: "PATCH", body: JSON.stringify({ status, confirmAfterSubmissions: confirmed }) });
    const data = await response.json(); if (!response.ok) return toast.error(data.error || "Could not update homework"); toast.success(`Homework ${status}`); await load();
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!classroom || !assignment) return <div className="p-10">Homework not found.</div>;
  const teacher = classroom.role === "teacher";
  const submitted = submissions.filter((item) => item.id).length;
  const published = submissions.filter((item) => item.review_status === "published").length;

  return <div className="mx-auto max-w-6xl space-y-7 p-6 md:p-10">
    <Link href={`/dashboard/classrooms/${params.id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 h-4 w-4" />{classroom.name}</Link>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex gap-2"><Badge>{assignment.status}</Badge>{assignment.is_late && <Badge variant="destructive">Late</Badge>}</div><h1 className="text-3xl font-bold">{assignment.title}</h1><p className="mt-2 text-sm text-muted-foreground">Due {format(new Date(assignment.due_at), "PPpp")} · {assignment.max_marks} marks</p></div>{teacher && <div className="flex gap-2">{assignment.status === "draft" && <Button onClick={() => void setAssignmentStatus("published")}>Publish</Button>}{assignment.status === "published" && <Button variant="outline" onClick={() => void setAssignmentStatus("closed")}>Close submissions</Button>}</div>}</div>
    <Card><CardHeader><CardTitle className="text-lg">Instructions</CardTitle><CardDescription>{[assignment.lesson_number && `Lesson ${assignment.lesson_number}`, assignment.chapter_number && `Chapter ${assignment.chapter_number}`, assignment.chapter_name].filter(Boolean).join(" · ") || "General assignment"}</CardDescription></CardHeader><CardContent className="space-y-4"><p className="whitespace-pre-wrap text-sm leading-6">{assignment.instructions}</p>{assignment.attachments?.length > 0 && <div className="flex flex-wrap gap-2">{assignment.attachments.map((file: any) => <Button key={file.id} variant="outline" size="sm" asChild><a href={`/api/classrooms/files/${file.id}`}>{file.file_name}</a></Button>)}</div>}</CardContent></Card>

    {teacher ? <>
      <div className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="pt-6"><UsersRound className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-2xl font-semibold">{submitted}/{submissions.length}</p><p className="text-xs text-muted-foreground">Submitted</p></CardContent></Card><Card><CardContent className="pt-6"><Bot className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-2xl font-semibold">{submissions.filter((s) => s.evaluation_status === "completed").length}</p><p className="text-xs text-muted-foreground">AI evaluated</p></CardContent></Card><Card><CardContent className="pt-6"><UserCheck className="mb-2 h-5 w-5 text-muted-foreground" /><p className="text-2xl font-semibold">{published}</p><p className="text-xs text-muted-foreground">Published by teacher</p></CardContent></Card></div>
      <Card><CardHeader><CardTitle>Student submissions</CardTitle><CardDescription>AI suggestions are drafts. You remain the final authority.</CardDescription></CardHeader><CardContent className="space-y-3">{submissions.map((submission) => <div key={submission.student_user_id} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{[submission.first_name, submission.last_name].filter(Boolean).join(" ") || submission.email}</p><div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">{submission.id ? <><span>{submission.status}</span><span>{format(new Date(submission.submitted_at), "PPp")}</span>{submission.is_late ? <span className="text-destructive">Late</span> : null}</> : <span>Not submitted</span>}</div></div>{submission.id && <div className="flex items-center gap-2">{submission.initial_score != null && <Badge variant="outline">AI: {submission.initial_score}/{assignment.max_marks}</Badge>}<Button size="icon" variant="ghost" aria-label="Recheck with AI" disabled={busy} onClick={() => void recheckAI(submission.id)}><RefreshCw className="h-4 w-4" /></Button><Button size="sm" variant={submission.review_status === "published" ? "outline" : "default"} onClick={() => void openReview(submission)}>{submission.review_status === "published" ? "View review" : "Review"}</Button></div>}</div>)}</CardContent></Card>
    </> : <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>{mySubmission ? "Submit a new version" : "Submit homework"}</CardTitle><CardDescription>{assignment.allow_resubmission ? "Every submission is retained as a separate version." : "This assignment allows one submission."}</CardDescription></CardHeader><CardContent><form action={submit} className="space-y-4"><Textarea name="textContent" className="min-h-52" placeholder="Write an answer, attach your work, or do both…" disabled={Boolean(mySubmission && !assignment.allow_resubmission)} /><div className="space-y-2"><Label>Files <span className="font-normal text-muted-foreground">(optional, 20 MB each)</span></Label><Input name="attachments" type="file" multiple accept=".pdf,.txt,.csv,.doc,.docx,.ppt,.pptx,.xlsx,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.wav,.mp4,.webm,.mov" disabled={Boolean(mySubmission && !assignment.allow_resubmission)} />{uploadProgress != null && <div aria-live="polite"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Uploading directly to secure storage</span><span>{uploadProgress}%</span></div><Progress value={uploadProgress} /></div>}</div><Button disabled={busy || Boolean(mySubmission && !assignment.allow_resubmission)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Submit</Button></form></CardContent></Card>
      <Card><CardHeader><CardTitle>Submission status</CardTitle><CardDescription>Teacher feedback appears only after it is published.</CardDescription></CardHeader><CardContent>{!mySubmission ? <div className="flex min-h-40 flex-col items-center justify-center text-center"><Clock className="mb-3 h-9 w-9 text-muted-foreground" /><p className="font-medium">Not submitted</p></div> : <div className="space-y-5"><div className="flex items-center justify-between"><Badge>{mySubmission.status}</Badge><span className="text-xs text-muted-foreground">Version {mySubmission.current_version}</span></div>{mySubmission.review_status === "published" ? <><div><div className="mb-2 flex justify-between text-sm"><span>Marks</span><strong>{mySubmission.marks}/{assignment.max_marks}</strong></div><Progress value={(Number(mySubmission.marks) / Number(assignment.max_marks)) * 100} /></div><Feedback title="Teacher remarks" content={mySubmission.remarks} /><Feedback title="Areas for improvement" content={mySubmission.teacher_improvements} /><div className="rounded-lg border border-primary/20 bg-primary/5 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Bot className="h-4 w-4" />AI-generated feedback</div><p className="whitespace-pre-wrap text-sm text-muted-foreground">{mySubmission.ai_feedback || "No AI feedback was included."}</p></div></> : <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4"><CheckCircle2 className="h-5 w-5 text-primary" /><div><p className="text-sm font-medium">Submission received</p><p className="text-xs text-muted-foreground">Waiting for your teacher to review and publish the result.</p></div></div>}</div>}</CardContent></Card></div>}

    <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Review submission</DialogTitle><DialogDescription>Check the student work and AI draft, then provide the final teacher decision.</DialogDescription></DialogHeader>{selected && <form action={review} className="space-y-4"><div className="rounded-lg border p-4"><p className="mb-2 text-sm font-medium">Student answer</p><p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-muted-foreground">{selected.text_content || "No written answer was provided."}</p>{selected.attachments?.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selected.attachments.map((file: any) => <Button key={file.id} variant="outline" size="sm" asChild><a href={`/api/classrooms/files/${file.id}`}>{file.file_name}</a></Button>)}</div>}</div>{versions.length > 0 && <details className="rounded-lg border p-4"><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><History className="h-4 w-4" />Version history ({versions.length})</summary><div className="mt-3 space-y-2">{versions.map((version) => <div key={version.id} className="rounded border p-3 text-xs"><p className="font-medium">Version {version.version_number} · {format(new Date(version.submitted_at), "PPp")}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{version.text_content || "File-only submission"}</p></div>)}</div></details>}<div className="rounded-lg border bg-muted/30 p-4"><div className="mb-2 flex items-center gap-2 font-medium"><Bot className="h-4 w-4" />AI evaluation <Badge variant="outline">Draft</Badge></div><p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.ai_feedback || (selected.evaluation_status === "failed" ? "AI evaluation failed. Review manually." : "AI evaluation is still processing.")}</p>{selected.initial_score != null && <p className="mt-3 text-sm font-semibold">Suggested score: {selected.initial_score}/{assignment.max_marks}</p>}{selected.ai_confidence != null && <p className="mt-1 text-xs text-muted-foreground">Confidence: {Math.round(Number(selected.ai_confidence) * 100)}%</p>}</div><div className="space-y-2"><Label>Marks</Label><Input name="marks" type="number" min="0" max={assignment.max_marks} step="0.5" defaultValue={selected.marks ?? selected.initial_score ?? 0} required /></div><div className="space-y-2"><Label>Teacher remarks</Label><Textarea name="remarks" defaultValue={selected.remarks || ""} /></div><div className="space-y-2"><Label>Areas for improvement</Label><Textarea name="improvements" defaultValue={selected.teacher_improvements || ""} /></div><div className="space-y-2"><Label>Override reason <span className="font-normal text-muted-foreground">(recommended when changing AI marks)</span></Label><Input name="overrideReason" /></div><div className="flex justify-end gap-2"><Button name="action" value="draft" variant="outline" disabled={busy}>Save draft</Button><Button name="action" value="publish" disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish result</Button></div></form>}</DialogContent></Dialog>
  </div>;
}

function Feedback({ title, content }: { title: string; content?: string }) { return <div><h3 className="mb-1 text-sm font-medium">{title}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{content || "—"}</p></div>; }
