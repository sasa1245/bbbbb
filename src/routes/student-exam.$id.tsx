import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { studentGetExam, studentSubmit } from "@/lib/student.functions";
import { getStudentSession } from "@/lib/student-session";
import { subjectThemeVars, TEMPLATES } from "@/lib/subjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowDown, ArrowUp } from "lucide-react";

export const Route = createFileRoute("/student-exam/$id")({
  head: () => ({
    meta: [
      { title: "الامتحان — اختبرني" },
      { name: "description", content: "شاشة الامتحان مع المراقبة والحفظ التلقائي." },
      { property: "og:title", content: "الامتحان — اختبرني" },
      { property: "og:description", content: "شاشة الامتحان مع المراقبة والحفظ التلقائي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExamScreen,
});

type Exam = Awaited<ReturnType<typeof studentGetExam>>;
type Q = Exam["questions"][number];
type Violation = { type: string; at: string };
interface Draft { answers: Record<string, unknown>; log: Violation[]; deadline: number }

function ExamScreen() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [log, setLog] = useState<Violation[]>([]);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);
  const key = code ? `ekh_draft_${code}_${id}` : "";

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { navigate({ to: "/student" }); return; }
    setCode(s.code);
    studentGetExam({ data: { code: s.code, examId: id } })
      .then((e) => {
        setExam(e);
        const raw = localStorage.getItem(`ekh_draft_${s.code}_${id}`);
        if (raw) {
          const d = JSON.parse(raw) as Draft;
          setAnswers(d.answers); setLog(d.log); setDeadline(d.deadline); setStarted(true);
        }
      })
      .catch((err) => { toast.error(err instanceof Error ? err.message : "خطأ"); navigate({ to: "/student" }); });
  }, [id, navigate]);

  // autosave
  useEffect(() => {
    if (started && key && !submitted.current) localStorage.setItem(key, JSON.stringify({ answers, log, deadline } satisfies Draft));
  }, [answers, log, deadline, started, key]);

  const submit = useCallback(async (forceZero = false) => {
    if (!exam || !code || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    try {
      await studentSubmit({ data: { code, examId: exam.id, answers, cheatLog: log, forceZero } });
      localStorage.removeItem(key);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      toast.success(forceZero ? "تم التسليم تلقائياً بسبب المخالفات" : "تم التسليم بنجاح");
      navigate({ to: "/student" });
    } catch (err) {
      submitted.current = false;
      toast.error(err instanceof Error ? err.message : "تعذر التسليم");
    } finally { setBusy(false); }
  }, [exam, code, answers, log, key, navigate]);

  // timer
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [started]);
  useEffect(() => { if (started && deadline && now >= deadline) submit(false); }, [now, deadline, started, submit]);

  // anti-cheat
  const lastV = useRef(0);
  const addViolation = useCallback((type: string) => {
    if (submitted.current) return;
    const t = Date.now();
    if (t - lastV.current < 3000) return; // cooldown
    lastV.current = t;
    setLog((l) => [...l, { type, at: new Date().toISOString() }]);
  }, []);
  useEffect(() => {
    if (!started) return;
    const isMobile = matchMedia("(pointer: coarse)").matches;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => { if (document.hidden) addViolation("تغيير التاب"); };
    const onBlur = () => {
      const el = document.activeElement;
      if (isMobile && el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return; // keyboard noise
      blurTimer = setTimeout(() => { if (!document.hasFocus() && !document.hidden) addViolation("فقدان التركيز"); }, 1500); // grace
    };
    const onFocus = () => clearTimeout(blurTimer);
    const onFs = () => { if (!document.fullscreenElement && !isMobile) addViolation("الخروج من ملء الشاشة"); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [started, addViolation]);
  useEffect(() => {
    if (!exam || !started || !log.length) return;
    if (log.length >= exam.max_violations) submit(true);
    else toast.warning(`تحذير ${log.length} من ${exam.max_violations}: ${log[log.length - 1]!.type}`);
  }, [log.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exam) return <div className="p-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  const theme = subjectThemeVars(exam.subject) as React.CSSProperties;

  if (!started) {
    return (
      <div style={theme} className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-3xl border bg-card p-8 text-center shadow-soft">
          <h1 className="font-display text-3xl text-primary">{exam.title}</h1>
          <p className="mt-3 text-muted-foreground">{exam.questions.length} سؤال · {exam.duration_min} دقيقة</p>
          <ul className="mt-5 space-y-1 text-right text-sm text-muted-foreground">
            <li>• الامتحان هيفتح في ملء الشاشة.</li>
            <li>• تغيير التاب أو الخروج من الشاشة بيتسجل مخالفة.</li>
            <li>• بعد {exam.max_violations} مخالفات بيتسلم الامتحان بدرجة صفر.</li>
            <li>• إجاباتك بتتحفظ تلقائياً، والوقت مش بيتصفر لو عملت refresh.</li>
          </ul>
          <Button className="mt-6 w-full" onClick={() => {
            document.documentElement.requestFullscreen?.().catch(() => {});
            setDeadline(Date.now() + exam.duration_min * 60000);
            setStarted(true);
          }}>ابدأ الامتحان</Button>
          <Link to="/student" className="mt-3 inline-block text-sm text-muted-foreground underline">رجوع</Link>
        </div>
      </div>
    );
  }

  const left = Math.max(0, deadline - now);
  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const tpl = TEMPLATES.find((t) => t.key === exam.template) ?? TEMPLATES[0];
  const set = (qid: string, v: unknown) => setAnswers((a) => ({ ...a, [qid]: v }));
  const shown = tpl.paged ? [exam.questions[page]!].filter(Boolean) : exam.questions;
  const answered = exam.questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== "").length;

  const card: Record<string, string> = {
    classic: "border-b pb-6",
    single: "rounded-2xl border bg-card p-6 shadow-soft",
    cards: "rounded-3xl border-2 border-primary/20 bg-card p-6 shadow-soft",
    focus: "rounded-3xl bg-card p-10 text-lg shadow-soft",
    compact: "rounded-lg border bg-card p-3 text-sm",
    notebook: "rounded-md border-r-4 border-primary bg-card p-5",
  };

  return (
    <div style={theme} className="min-h-screen select-none bg-background" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="truncate font-bold">{exam.title}</div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{answered}/{exam.questions.length}</span>
            {log.length > 0 && <span className="rounded bg-destructive/10 px-2 py-1 text-destructive">مخالفات {log.length}/{exam.max_violations}</span>}
            <span className={`font-mono text-lg ${left < 60000 ? "text-destructive" : "text-primary"}`} dir="ltr">{mm}:{ss}</span>
          </div>
        </div>
      </header>
      <main className={`mx-auto max-w-3xl px-4 py-6 ${tpl.key === "compact" ? "space-y-2" : "space-y-6"}`}>
        {shown.map((q) => {
          const idx = exam.questions.indexOf(q);
          return (
            <section key={q.id} className={card[tpl.key]}>
              <div className="mb-3 flex justify-between gap-3">
                <h2 className="font-bold">{idx + 1}. {q.text}</h2>
                <span className="shrink-0 text-xs text-muted-foreground">{q.points} درجة</span>
              </div>
              {q.media && <img src={q.media} alt="" className="mb-3 max-h-64 rounded-lg" />}
              <QuestionInput q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} />
            </section>
          );
        })}
        <div className="flex items-center justify-between gap-2">
          {tpl.paged ? (
            <>
              <Button variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</Button>
              {page < exam.questions.length - 1
                ? <Button onClick={() => setPage(page + 1)}>التالي</Button>
                : <Button disabled={busy} onClick={() => confirm("تسليم الامتحان؟") && submit(false)}>تسليم</Button>}
            </>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => confirm("تسليم الامتحان؟") && submit(false)}>تسليم الامتحان</Button>
          )}
        </div>
      </main>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: Q; value: unknown; onChange: (v: unknown) => void }) {
  if (q.type === "mcq")
    return (
      <div className="grid gap-2">
        {(q.options ?? []).map((o, i) => (
          <button key={i} type="button" onClick={() => onChange(i)} className={`rounded-xl border px-4 py-3 text-right transition ${value === i ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}>{o}</button>
        ))}
      </div>
    );
  if (q.type === "tf")
    return (
      <div className="flex gap-2">
        {[true, false].map((b) => (
          <button key={String(b)} type="button" onClick={() => onChange(b)} className={`flex-1 rounded-xl border py-3 ${value === b ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"}`}>{b ? "صح" : "خطأ"}</button>
        ))}
      </div>
    );
  if (q.type === "fill") return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="اكتب إجابتك" />;
  if (q.type === "essay") return <Textarea rows={5} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder="اكتب إجابتك" />;
  if (q.type === "match") {
    const v = (value ?? {}) as Record<string, string>;
    return (
      <div className="space-y-2">
        {(q.lefts ?? []).map((l, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="flex-1">{l}</span>
            <select className="flex-1 rounded-md border bg-background px-2 py-2" value={v[i] ?? ""} onChange={(e) => onChange({ ...v, [i]: e.target.value })}>
              <option value="">اختر…</option>
              {(q.rights ?? []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  if (q.type === "order") {
    const list = Array.isArray(value) ? (value as string[]) : (q.items ?? []);
    const move = (i: number, d: number) => {
      const r = [...list]; const j = i + d;
      if (j < 0 || j >= r.length) return;
      [r[i], r[j]] = [r[j]!, r[i]!]; onChange(r);
    };
    return (
      <ol className="space-y-2">
        {list.map((it, i) => (
          <li key={it} className="flex items-center gap-2 rounded-lg border px-3 py-2">
            <span className="w-6 text-muted-foreground">{i + 1}</span>
            <span className="flex-1">{it}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => move(i, 1)}><ArrowDown /></Button>
          </li>
        ))}
      </ol>
    );
  }
  return null;
}
