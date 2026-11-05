import { createServerFn } from "@tanstack/react-start";
import { scoreExam, finalScore, type Question } from "./scoring";

// Students have no accounts: every call re-validates the student code server-side.
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadStudent(code: string) {
  const db = await admin();
  const { data } = await db
    .from("students")
    .select("id, name, code, active, group_id, teacher_id, groups(name, welcome_message), teachers(subject, status)")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();
  if (!data || !data.active) throw new Error("الكود غير صحيح أو الحساب موقوف");
  const t = data.teachers as unknown as { subject: string; status: string } | null;
  if (!t || t.status !== "active") throw new Error("المدرس غير مفعل حالياً");
  return { db, student: data, subject: t.subject };
}

const codeInput = (i: { code: string }) => ({ code: String(i.code ?? "").slice(0, 20) });

export const studentLogin = createServerFn({ method: "POST" })
  .inputValidator(codeInput)
  .handler(async ({ data }) => {
    const { student, subject } = await loadStudent(data.code);
    const g = student.groups as unknown as { name: string; welcome_message: string | null } | null;
    return {
      code: student.code,
      id: student.id,
      name: student.name,
      groupName: g?.name ?? "",
      welcome: g?.welcome_message ?? null,
      subject,
    };
  });

export const studentExams = createServerFn({ method: "POST" })
  .inputValidator(codeInput)
  .handler(async ({ data }) => {
    const { db, student } = await loadStudent(data.code);
    const { data: links } = await db.from("exam_groups").select("exam_id").eq("group_id", student.group_id);
    const ids = (links ?? []).map((l) => l.exam_id);
    if (!ids.length) return [];
    const { data: exams } = await db
      .from("exams")
      .select("id, title, duration_min, questions")
      .in("id", ids)
      .eq("status", "active");
    const { data: subs } = await db.from("submissions").select("exam_id").eq("student_id", student.id);
    return (exams ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      duration_min: e.duration_min,
      count: (e.questions as unknown as Question[]).length,
      attempts: (subs ?? []).filter((s) => s.exam_id === e.id).length,
    }));
  });

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = r[i] as T; r[i] = r[j] as T; r[j] = t;
  }
  return r;
}

async function loadActiveExam(db: Awaited<ReturnType<typeof admin>>, examId: string, groupId: string) {
  const { data: link } = await db
    .from("exam_groups")
    .select("exam_id")
    .eq("exam_id", examId)
    .eq("group_id", groupId)
    .maybeSingle();
  if (!link) throw new Error("الامتحان غير متاح لك");
  const { data: exam } = await db.from("exams").select("*").eq("id", examId).maybeSingle();
  if (!exam || exam.status !== "active") throw new Error("الامتحان غير متاح الآن");
  return exam;
}

export const studentGetExam = createServerFn({ method: "POST" })
  .inputValidator((i: { code: string; examId: string }) => ({ code: String(i.code), examId: String(i.examId) }))
  .handler(async ({ data }) => {
    const { db, student, subject } = await loadStudent(data.code);
    const exam = await loadActiveExam(db, data.examId, student.group_id);
    const qs = (exam.questions as unknown as Question[]).map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      points: q.points,
      media: q.media,
      options: q.type === "mcq" ? q.options : undefined,
      lefts: q.type === "match" ? (q.pairs ?? []).map((p) => p.left) : undefined,
      rights: q.type === "match" ? shuffle((q.pairs ?? []).map((p) => p.right)) : undefined,
      items: q.type === "order" ? shuffle(q.items ?? []) : undefined,
    }));
    return {
      id: exam.id,
      title: exam.title,
      template: exam.template,
      duration_min: exam.duration_min,
      max_violations: exam.max_violations,
      subject,
      questions: qs,
    };
  });

export const studentSubmit = createServerFn({ method: "POST" })
  .inputValidator(
    (i: { code: string; examId: string; answers: Record<string, unknown>; cheatLog: unknown[]; forceZero: boolean }) => i,
  )
  .handler(async ({ data }) => {
    const { db, student } = await loadStudent(data.code);
    const exam = await loadActiveExam(db, data.examId, student.group_id);
    const questions = exam.questions as unknown as Question[];
    const log = Array.isArray(data.cheatLog) ? data.cheatLog.slice(0, 500) : [];
    const forced = Boolean(data.forceZero) || log.length >= exam.max_violations;
    const r = scoreExam(questions, data.answers ?? {});
    const { count } = await db
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("exam_id", exam.id)
      .eq("student_id", student.id);
    const final = forced ? 0 : r.hasEssay ? null : finalScore(questions, r.auto, {});
    const { error } = await db.from("submissions").insert({
      exam_id: exam.id,
      student_id: student.id,
      attempt_num: (count ?? 0) + 1,
      answers: data.answers as never,
      cheat_log: log as never,
      auto_score: forced ? 0 : r.auto,
      max_score: r.max,
      has_pending_essay: !forced && r.hasEssay,
      final_score: final,
      forced_zero: forced,
    });
    if (error) throw new Error("تعذر حفظ التسليم، حاول مرة أخرى");
    return { ok: true };
  });

export const studentResults = createServerFn({ method: "POST" })
  .inputValidator(codeInput)
  .handler(async ({ data }) => {
    const { db, student } = await loadStudent(data.code);
    const { data: subs } = await db
      .from("submissions")
      .select("id, attempt_num, final_score, max_score, forced_zero, submitted_at, exams(title)")
      .eq("student_id", student.id)
      .order("submitted_at", { ascending: false });
    return (subs ?? []).map((s) => ({
      id: s.id,
      attempt_num: s.attempt_num,
      final_score: s.final_score,
      max_score: s.max_score,
      forced_zero: s.forced_zero,
      submitted_at: s.submitted_at,
      title: (s.exams as unknown as { title: string } | null)?.title ?? "",
    }));
  });
