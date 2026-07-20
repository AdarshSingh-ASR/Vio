import crypto from "crypto";
import { executeQuery, executeSingle, withTransaction } from "@/lib/tidb";
import { ApiError } from "@/lib/request-auth";
import { evaluateSubmissionPolicy } from "@/lib/classroom-policy";

export type ClassroomRole = "teacher" | "student";

const id = () => crypto.randomUUID();
const parseJson = <T>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export async function getMembership(classroomId: string, userId: string) {
  const rows = await executeQuery<any>(
    `SELECT cm.role, cm.status, c.owner_user_id, c.status AS classroom_status
     FROM classroom_members cm JOIN classrooms c ON c.id = cm.classroom_id
     WHERE cm.classroom_id = ? AND cm.user_id = ? AND cm.status = 'active'`,
    [classroomId, userId]
  );
  return rows[0] || null;
}

async function requireMembership(classroomId: string, userId: string, role?: ClassroomRole) {
  const membership = await getMembership(classroomId, userId);
  if (!membership) throw new ApiError(403, "You are not a member of this classroom", "CLASSROOM_FORBIDDEN");
  if (role && membership.role !== role) throw new ApiError(403, `${role} access required`, "CLASSROOM_ROLE_REQUIRED");
  return membership;
}

export const classroomService = {
  async listForUser(userId: string) {
    return executeQuery<any>(
      `SELECT c.*, cm.role,
        (SELECT COUNT(*) FROM classroom_members members WHERE members.classroom_id = c.id AND members.status = 'active' AND members.role = 'student') AS student_count,
        (SELECT COUNT(*) FROM homework_assignments assignments WHERE assignments.classroom_id = c.id AND assignments.status != 'draft') AS assignment_count
       FROM classrooms c JOIN classroom_members cm ON cm.classroom_id = c.id
       WHERE cm.user_id = ? AND cm.status = 'active' AND c.status = 'active'
       ORDER BY c.updated_at DESC`,
      [userId]
    );
  },

  async create(userId: string, input: { name: string; subject?: string; description?: string; workspaceId?: string }) {
    const classroomId = id();
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO classrooms (id, owner_user_id, workspace_id, name, subject, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [classroomId, userId, input.workspaceId || null, input.name.trim(), input.subject?.trim() || null, input.description?.trim() || null]
      );
      await connection.execute(
        `INSERT INTO classroom_members (id, classroom_id, user_id, role) VALUES (?, ?, ?, 'teacher')`,
        [id(), classroomId, userId]
      );
      await connection.execute(
        `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, 'classroom.created', 'classroom', ?, JSON_OBJECT('name', ?))`,
        [userId, classroomId, input.name.trim()]
      );
    });
    return this.get(classroomId, userId);
  },

  async get(classroomId: string, userId: string) {
    const membership = await requireMembership(classroomId, userId);
    const classrooms = await executeQuery<any>(
      `SELECT c.*, u.first_name AS owner_first_name, u.last_name AS owner_last_name
       FROM classrooms c JOIN users u ON u.id = c.owner_user_id WHERE c.id = ?`,
      [classroomId]
    );
    if (!classrooms[0]) throw new ApiError(404, "Classroom not found", "CLASSROOM_NOT_FOUND");
    const members = await executeQuery<any>(
      `SELECT cm.user_id, cm.role, cm.joined_at, u.first_name, u.last_name, u.email
       FROM classroom_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.classroom_id = ? AND cm.status = 'active' ORDER BY cm.role, cm.joined_at`,
      [classroomId]
    );
    const assignmentFilter = membership.role === "teacher" ? "" : "AND a.status != 'draft'";
    const assignments = await executeQuery<any>(
      `SELECT a.*,
        (SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id = a.id AND s.status != 'draft') AS submission_count,
        (SELECT status FROM homework_submissions mine WHERE mine.assignment_id = a.id AND mine.student_user_id = ? LIMIT 1) AS my_submission_status
       FROM homework_assignments a WHERE a.classroom_id = ? ${assignmentFilter} ORDER BY a.due_at ASC`,
      [userId, classroomId]
    );
    const attachments = await executeQuery<any>(
      `SELECT aa.id, aa.assignment_id, aa.file_name, aa.mime_type, aa.size_bytes
       FROM assignment_attachments aa JOIN homework_assignments a ON a.id = aa.assignment_id
       WHERE a.classroom_id = ?`,
      [classroomId]
    );
    return { ...classrooms[0], role: membership.role, members, assignments: assignments.map((a) => ({ ...a, rubric_json: parseJson(a.rubric_json, []), attachments: attachments.filter((file) => file.assignment_id === a.id) })) };
  },

  async createInvite(classroomId: string, userId: string, expiresInDays = 7, maxUses = 50) {
    await requireMembership(classroomId, userId, "teacher");
    const code = crypto.randomBytes(5).toString("base64url").toUpperCase();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const inviteId = id();
    await executeSingle(
      `INSERT INTO classroom_invites (id, classroom_id, code_hash, code_hint, created_by, max_uses, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))`,
      [inviteId, classroomId, codeHash, code.slice(-4), userId, Math.min(Math.max(maxUses, 1), 500), Math.min(Math.max(expiresInDays, 1), 30)]
    );
    return { id: inviteId, code, expiresInDays, maxUses };
  },

  async listInvites(classroomId: string, userId: string) {
    await requireMembership(classroomId, userId, "teacher");
    return executeQuery<any>(
      `SELECT id, code_hint, max_uses, use_count, expires_at, revoked_at, created_at
       FROM classroom_invites WHERE classroom_id=? ORDER BY created_at DESC`,
      [classroomId]
    );
  },

  async revokeInvite(classroomId: string, inviteId: string, userId: string) {
    await requireMembership(classroomId, userId, "teacher");
    const result = await executeSingle(`UPDATE classroom_invites SET revoked_at=UTC_TIMESTAMP(), revoked_by=? WHERE id=? AND classroom_id=? AND revoked_at IS NULL`, [userId, inviteId, classroomId]);
    if (result.affectedRows !== 1) throw new ApiError(404, "Active invite not found", "INVITE_NOT_FOUND");
    await executeSingle(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id) VALUES (?, 'classroom.invite.revoked', 'classroom_invite', ?)`, [userId, inviteId]);
    return { success: true };
  },

  async join(userId: string, rawCode: string) {
    const normalized = rawCode.trim().toUpperCase();
    const codeHash = crypto.createHash("sha256").update(normalized).digest("hex");
    const attempts = await executeQuery<any>(`SELECT COUNT(*) AS count FROM classroom_invite_attempts WHERE user_id=? AND attempted_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)`, [userId]);
    if (Number(attempts[0]?.count || 0) >= 10) throw new ApiError(429, "Too many invite attempts; try again later", "INVITE_RATE_LIMITED");
    const attempt = await executeSingle(`INSERT INTO classroom_invite_attempts (user_id, code_hash, succeeded) VALUES (?, ?, FALSE)`, [userId, codeHash]);
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute<any[]>(
        `SELECT * FROM classroom_invites WHERE code_hash = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP() AND use_count < max_uses FOR UPDATE`,
        [codeHash]
      );
      const invite = rows[0];
      if (!invite) throw new ApiError(400, "Invite code is invalid or expired", "INVITE_INVALID");
      await connection.execute(
        `INSERT INTO classroom_members (id, classroom_id, user_id, role, status)
         VALUES (?, ?, ?, 'student', 'active')
         ON DUPLICATE KEY UPDATE status = 'active'`,
        [id(), invite.classroom_id, userId]
      );
      await connection.execute(`UPDATE classroom_invites SET use_count = use_count + 1 WHERE id = ?`, [invite.id]);
      await connection.execute(
        `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id) VALUES (?, 'classroom.joined', 'classroom', ?)`,
        [userId, invite.classroom_id]
      );
      return { classroomId: invite.classroom_id };
    });
    await executeSingle(`UPDATE classroom_invite_attempts SET succeeded=TRUE WHERE id=?`, [attempt.insertId]);
    return result;
  },

  async archive(classroomId: string, userId: string) {
    const membership = await requireMembership(classroomId, userId, "teacher");
    if (membership.owner_user_id !== userId) throw new ApiError(403, "Only the classroom owner can archive it", "CLASSROOM_OWNER_REQUIRED");
    await executeSingle(`UPDATE classrooms SET status='archived' WHERE id=?`, [classroomId]);
    await executeSingle(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id) VALUES (?, 'classroom.archived', 'classroom', ?)`, [userId, classroomId]);
    return { success: true };
  },

  async removeMember(classroomId: string, memberUserId: string, userId: string) {
    const membership = await requireMembership(classroomId, userId, "teacher");
    if (memberUserId === membership.owner_user_id) throw new ApiError(409, "The classroom owner cannot be removed", "CLASSROOM_OWNER_REMOVE_BLOCKED");
    const result = await executeSingle(`UPDATE classroom_members SET status='removed' WHERE classroom_id=? AND user_id=? AND status='active'`, [classroomId, memberUserId]);
    if (result.affectedRows !== 1) throw new ApiError(404, "Active classroom member not found", "MEMBER_NOT_FOUND");
    await executeSingle(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, 'classroom.member.removed', 'classroom', ?, JSON_OBJECT('memberUserId', ?))`, [userId, classroomId, memberUserId]);
    return { success: true };
  },

  async createAssignment(classroomId: string, userId: string, input: any) {
    await requireMembership(classroomId, userId, "teacher");
    if (!input.title?.trim() || !input.instructions?.trim() || !input.dueAt) {
      throw new ApiError(400, "Title, instructions, and due date are required", "ASSIGNMENT_INVALID");
    }
    const assignmentId = id();
    await executeSingle(
      `INSERT INTO homework_assignments
       (id, classroom_id, creator_user_id, title, lesson_number, chapter_number, chapter_name, instructions, rubric_json, due_at, max_marks, allow_late, allow_resubmission, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignmentId, classroomId, userId, input.title.trim(), input.lessonNumber || null, input.chapterNumber || null,
       input.chapterName || null, input.instructions.trim(), JSON.stringify(input.rubric || []), new Date(input.dueAt),
       Math.max(Number(input.maxMarks || 100), 1), Boolean(input.allowLate), input.allowResubmission !== false,
       input.status === "published" ? "published" : "draft"]
    );
    return { id: assignmentId };
  },

  async updateAssignment(classroomId: string, assignmentId: string, userId: string, input: any) {
    await requireMembership(classroomId, userId, "teacher");
    const rows = await executeQuery<any>(
      `SELECT a.*, (SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id=a.id AND s.current_version>0) AS submission_count
       FROM homework_assignments a WHERE a.id=? AND a.classroom_id=?`,
      [assignmentId, classroomId]
    );
    const assignment = rows[0];
    if (!assignment) throw new ApiError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
    if (Number(assignment.submission_count) > 0 && !input.confirmAfterSubmissions) {
      throw new ApiError(409, "This assignment has submissions; confirm the change explicitly", "ASSIGNMENT_CONFIRMATION_REQUIRED");
    }
    const status = input.status || assignment.status;
    if (!["draft", "published", "closed"].includes(status)) throw new ApiError(400, "Invalid assignment status", "ASSIGNMENT_STATUS_INVALID");
    const rubricJson = input.rubric
      ? JSON.stringify(input.rubric)
      : typeof assignment.rubric_json === "string"
        ? assignment.rubric_json
        : JSON.stringify(assignment.rubric_json || []);
    await executeSingle(
      `UPDATE homework_assignments SET title=?, lesson_number=?, chapter_number=?, chapter_name=?, instructions=?, rubric_json=?, due_at=?, max_marks=?, allow_late=?, allow_resubmission=?, status=? WHERE id=? AND classroom_id=?`,
      [input.title ?? assignment.title, input.lessonNumber ?? assignment.lesson_number, input.chapterNumber ?? assignment.chapter_number,
       input.chapterName ?? assignment.chapter_name, input.instructions ?? assignment.instructions,
       rubricJson, input.dueAt ? new Date(input.dueAt) : assignment.due_at,
       input.maxMarks ?? assignment.max_marks, input.allowLate ?? Boolean(assignment.allow_late), input.allowResubmission ?? Boolean(assignment.allow_resubmission),
       status, assignmentId, classroomId]
    );
    await executeSingle(
      `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, 'assignment.updated', 'assignment', ?, JSON_OBJECT('status', ?, 'hadSubmissions', ?))`,
      [userId, assignmentId, status, Number(assignment.submission_count) > 0]
    );
    return { success: true, status };
  },

  async listSubmissions(classroomId: string, assignmentId: string, userId: string) {
    await requireMembership(classroomId, userId, "teacher");
    const ownedAssignments = await executeQuery<any>(`SELECT id FROM homework_assignments WHERE id=? AND classroom_id=?`, [assignmentId, classroomId]);
    if (!ownedAssignments[0]) throw new ApiError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
    const submissions = await executeQuery<any>(
      `SELECT u.id AS student_user_id, u.first_name, u.last_name, u.email,
        s.id, s.status, s.current_version, s.submitted_at, s.is_late, sv.id AS version_id, sv.text_content,
        e.id AS evaluation_id, e.initial_score, e.feedback AS ai_feedback, e.strengths, e.weaknesses, e.improvements AS ai_improvements, e.citations AS ai_citations, e.confidence AS ai_confidence, e.status AS evaluation_status,
        r.marks, r.remarks, r.improvements AS teacher_improvements, r.status AS review_status, r.published_at
       FROM classroom_members cm JOIN users u ON u.id = cm.user_id
       LEFT JOIN homework_submissions s ON s.student_user_id = u.id AND s.assignment_id = ?
       LEFT JOIN submission_versions sv ON sv.submission_id = s.id AND sv.version_number = s.current_version
       LEFT JOIN (
         SELECT ranked.* FROM (
           SELECT evaluation.*, ROW_NUMBER() OVER (
             PARTITION BY evaluation.submission_version_id
             ORDER BY evaluation.created_at DESC, evaluation.id DESC
           ) AS evaluation_rank
           FROM ai_evaluations evaluation
         ) ranked WHERE ranked.evaluation_rank = 1
       ) e ON e.submission_version_id = sv.id
       LEFT JOIN teacher_reviews r ON r.submission_id = s.id AND r.submission_version_id = sv.id
       WHERE cm.classroom_id = ? AND cm.role = 'student' AND cm.status = 'active'
       ORDER BY u.first_name, u.last_name`,
      [assignmentId, classroomId]
    );
    const attachments = await executeQuery<any>(
      `SELECT sa.id, sa.submission_version_id, sa.file_name, sa.mime_type, sa.size_bytes
       FROM submission_attachments sa
       JOIN submission_versions sv ON sv.id = sa.submission_version_id
       JOIN homework_submissions s ON s.id = sv.submission_id
       WHERE s.assignment_id = ?`,
      [assignmentId]
    );
    return submissions.map((submission) => ({
      ...submission,
      attachments: attachments.filter((file) => file.submission_version_id === submission.version_id),
    }));
  },

  async submit(classroomId: string, assignmentId: string, userId: string, textContent: string) {
    await requireMembership(classroomId, userId, "student");
    const assignments = await executeQuery<any>(`SELECT * FROM homework_assignments WHERE id = ? AND classroom_id = ? AND status = 'published'`, [assignmentId, classroomId]);
    const assignment = assignments[0];
    if (!assignment) throw new ApiError(404, "Published assignment not found", "ASSIGNMENT_NOT_FOUND");
    return withTransaction(async (connection) => {
      const [existingRows] = await connection.execute<any[]>(`SELECT * FROM homework_submissions WHERE assignment_id = ? AND student_user_id = ? FOR UPDATE`, [assignmentId, userId]);
      const existing = existingRows[0];
      const policy = evaluateSubmissionPolicy({ dueAt: new Date(assignment.due_at), allowLate: Boolean(assignment.allow_late), allowResubmission: Boolean(assignment.allow_resubmission), existingVersions: Number(existing?.current_version || 0) });
      if (!policy.allowed && policy.code === "LATE_NOT_ALLOWED") throw new ApiError(409, "This assignment no longer accepts late submissions", policy.code);
      if (!policy.allowed) throw new ApiError(409, "Resubmissions are disabled", policy.code);
      const late = policy.isLate;
      const submissionId = existing?.id || id();
      const version = Number(existing?.current_version || 0) + 1;
      const versionId = id();
      if (existing) {
        await connection.execute(`UPDATE homework_submissions SET current_version = ?, status = 'evaluating', submitted_at = UTC_TIMESTAMP(), is_late = ? WHERE id = ?`, [version, late, submissionId]);
      } else {
        await connection.execute(
          `INSERT INTO homework_submissions (id, assignment_id, student_user_id, current_version, status, submitted_at, is_late) VALUES (?, ?, ?, ?, 'evaluating', UTC_TIMESTAMP(), ?)`,
          [submissionId, assignmentId, userId, version, late]
        );
      }
      await connection.execute(`INSERT INTO submission_versions (id, submission_id, version_number, text_content) VALUES (?, ?, ?, ?)`, [versionId, submissionId, version, textContent.trim()]);
      await connection.execute(
        `INSERT INTO ai_evaluations (id, submission_version_id, provider, model, status) VALUES (?, ?, 'pending', 'pending', 'pending')`,
        [id(), versionId]
      );
      return { submissionId, versionId, version, isLate: late };
    });
  },

  async getStudentSubmission(classroomId: string, assignmentId: string, userId: string) {
    await requireMembership(classroomId, userId, "student");
    const visibleAssignments = await executeQuery<any>(`SELECT id FROM homework_assignments WHERE id=? AND classroom_id=? AND status!='draft'`, [assignmentId, classroomId]);
    if (!visibleAssignments[0]) throw new ApiError(404, "Assignment not found", "ASSIGNMENT_NOT_FOUND");
    const rows = await executeQuery<any>(
      `SELECT s.*, sv.id AS version_id, sv.text_content, sv.submitted_at AS version_submitted_at,
        e.initial_score, e.feedback AS ai_feedback, e.strengths, e.weaknesses, e.improvements AS ai_improvements, e.citations AS ai_citations, e.confidence AS ai_confidence, e.status AS evaluation_status,
        r.marks, r.remarks, r.improvements AS teacher_improvements, r.status AS review_status, r.published_at
       FROM homework_submissions s
       JOIN submission_versions sv ON sv.submission_id = s.id AND sv.version_number = s.current_version
       LEFT JOIN (
         SELECT ranked.* FROM (
           SELECT evaluation.*, ROW_NUMBER() OVER (
             PARTITION BY evaluation.submission_version_id
             ORDER BY evaluation.created_at DESC, evaluation.id DESC
           ) AS evaluation_rank
           FROM ai_evaluations evaluation
         ) ranked WHERE ranked.evaluation_rank = 1
       ) e ON e.submission_version_id = sv.id
       LEFT JOIN teacher_reviews r ON r.submission_id = s.id AND r.submission_version_id = sv.id
       WHERE s.assignment_id = ? AND s.student_user_id = ?`,
      [assignmentId, userId]
    );
    if (!rows[0]) return null;
    const row = rows[0];
    row.attachments = await executeQuery<any>(`SELECT id, file_name, mime_type, size_bytes FROM submission_attachments WHERE submission_version_id = ? ORDER BY created_at`, [row.version_id]);
    if (row.review_status !== "published") {
      row.marks = row.remarks = row.teacher_improvements = row.ai_feedback = row.ai_improvements = row.strengths = row.weaknesses = null;
    }
    return row;
  },

  async getSubmissionVersions(classroomId: string, submissionId: string, userId: string) {
    const membership = await requireMembership(classroomId, userId);
    const submissions = await executeQuery<any>(
      `SELECT s.student_user_id, a.classroom_id FROM homework_submissions s
       JOIN homework_assignments a ON a.id=s.assignment_id WHERE s.id=? AND a.classroom_id=?`,
      [submissionId, classroomId]
    );
    if (!submissions[0]) throw new ApiError(404, "Submission not found", "SUBMISSION_NOT_FOUND");
    if (membership.role === "student" && submissions[0].student_user_id !== userId) throw new ApiError(403, "Submission access denied", "SUBMISSION_FORBIDDEN");
    const versions = await executeQuery<any>(
      `SELECT sv.id, sv.version_number, sv.text_content, sv.submitted_at,
              e.id AS evaluation_id, e.status AS evaluation_status, e.initial_score, e.feedback, e.strengths, e.weaknesses, e.improvements, e.citations, e.confidence,
              r.marks, r.remarks, r.improvements AS teacher_improvements, r.override_reason, r.status AS review_status, r.published_at
       FROM submission_versions sv
       LEFT JOIN (
         SELECT ranked.* FROM (
           SELECT evaluation.*, ROW_NUMBER() OVER (
             PARTITION BY evaluation.submission_version_id
             ORDER BY evaluation.created_at DESC, evaluation.id DESC
           ) AS evaluation_rank
           FROM ai_evaluations evaluation
         ) ranked WHERE ranked.evaluation_rank = 1
       ) e ON e.submission_version_id = sv.id
       LEFT JOIN teacher_reviews r ON r.submission_version_id=sv.id
       WHERE sv.submission_id=? ORDER BY sv.version_number DESC`,
      [submissionId]
    );
    const attachments = await executeQuery<any>(`SELECT id, submission_version_id, file_name, mime_type, size_bytes, created_at FROM submission_attachments WHERE submission_version_id IN (SELECT id FROM submission_versions WHERE submission_id=?) ORDER BY created_at`, [submissionId]);
    return versions.map((version) => ({ ...version, attachments: attachments.filter((file) => file.submission_version_id === version.id) }));
  },

  async createReevaluation(classroomId: string, submissionId: string, userId: string) {
    const membership = await requireMembership(classroomId, userId, "teacher");
    const rows = await executeQuery<any>(
      `SELECT sv.id AS version_id FROM homework_submissions s JOIN homework_assignments a ON a.id=s.assignment_id
       JOIN submission_versions sv ON sv.submission_id=s.id AND sv.version_number=s.current_version
       WHERE s.id=? AND a.classroom_id=?`,
      [submissionId, classroomId]
    );
    if (!rows[0]) throw new ApiError(404, "Submission not found", "SUBMISSION_NOT_FOUND");
    await executeSingle(`INSERT INTO ai_evaluations (id, submission_version_id, provider, model, status) VALUES (?, ?, 'pending', 'pending', 'pending')`, [id(), rows[0].version_id]);
    await executeSingle(`UPDATE homework_submissions SET status='evaluating' WHERE id=?`, [submissionId]);
    await executeSingle(`INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id) VALUES (?, 'evaluation.requeued', 'submission', ?)`, [userId, submissionId]);
    return { versionId: rows[0].version_id, ownerUserId: membership.owner_user_id };
  },

  async review(classroomId: string, submissionId: string, userId: string, input: any) {
    await requireMembership(classroomId, userId, "teacher");
    const rows = await executeQuery<any>(
      `SELECT s.*, a.max_marks, a.classroom_id, sv.id AS version_id,
       (SELECT e.id FROM ai_evaluations e WHERE e.submission_version_id = sv.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS evaluation_id,
       (SELECT e.initial_score FROM ai_evaluations e WHERE e.submission_version_id = sv.id ORDER BY e.created_at DESC, e.id DESC LIMIT 1) AS ai_score
       FROM homework_submissions s JOIN homework_assignments a ON a.id = s.assignment_id
       JOIN submission_versions sv ON sv.submission_id = s.id AND sv.version_number = s.current_version
       WHERE s.id = ? AND a.classroom_id = ?`,
      [submissionId, classroomId]
    );
    const submission = rows[0];
    if (!submission) throw new ApiError(404, "Submission not found", "SUBMISSION_NOT_FOUND");
    const marks = Number(input.marks);
    if (!Number.isFinite(marks) || marks < 0 || marks > Number(submission.max_marks)) throw new ApiError(400, "Marks must be within the assignment maximum", "MARKS_INVALID");
    if (submission.ai_score != null && marks !== Number(submission.ai_score) && !String(input.overrideReason || "").trim()) {
      throw new ApiError(400, "Explain why the final marks differ from the AI draft", "OVERRIDE_REASON_REQUIRED");
    }
    const status = input.publish ? "published" : "draft";
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO teacher_reviews (id, submission_id, submission_version_id, teacher_user_id, ai_evaluation_id, marks, remarks, improvements, override_reason, status, checked_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), IF(? = 'published', UTC_TIMESTAMP(), NULL))
         ON DUPLICATE KEY UPDATE submission_version_id = VALUES(submission_version_id), ai_evaluation_id = VALUES(ai_evaluation_id), marks = VALUES(marks), remarks = VALUES(remarks), improvements = VALUES(improvements), override_reason = VALUES(override_reason), status = VALUES(status), checked_at = UTC_TIMESTAMP(), published_at = IF(VALUES(status) = 'published', UTC_TIMESTAMP(), published_at)`,
        [id(), submissionId, submission.version_id, userId, submission.evaluation_id, marks, input.remarks || null, input.improvements || null, input.overrideReason || null, status, status]
      );
      await connection.execute(`UPDATE homework_submissions SET status = ? WHERE id = ?`, [status === "published" ? "published" : "checked", submissionId]);
      await connection.execute(
        `INSERT INTO audit_events (actor_user_id, action, resource_type, resource_id, metadata) VALUES (?, ?, 'submission', ?, JSON_OBJECT('marks', ?, 'published', ?))`,
        [userId, status === "published" ? "grade.published" : "grade.checked", submissionId, marks, status === "published"]
      );
    });
    return { success: true, status };
  },
};
