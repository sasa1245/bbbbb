import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { studentLogin, studentExams, studentResults } from "@/lib/student.functions";
import { getStudentSession, setStudentSession, clearStudentSession, type StudentSession } from "@/lib/student-session";
import { subjectInfo, subjectThemeVars } from "@/lib/subjects";
import { gradeLabel } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/AppShell";
import { toast } from "sonner";

export const Route = createFileRoute("/student")({
  head: () => ({
    meta: [
      { title: "دخول الطالب — اختبرني" },
      { name: "description", content: "ادخل بكود الطالب وامتحن امتحاناتك وشوف نتايجك." },
      { property: "og:title", content: "دخول الطالب — اختبرني" },
      { property: "og:description", content: "ادخل بكود الطالب وامتحن امتحاناتك وشوف نتايجك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudentPage,
});

function StudentPage() {
  const [session, setSession] = useState<StudentSession | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { setSession(getStudentSession()); setReady(true); }, []);
  if (!ready) return null;
  if (!session) return <Login onLogin={setSession} />;
  return <Portal s={session} onLogout={() => { clearStudentSession(); setSession(null); }} />;
}

function Login({ onLogin }: { onLogin: (s: StudentSession) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await studentLogin({ data: { code } });
      setStudentSession(r);
      onLogin(getStudentSession()!);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "حدث خطأ");
    } finally { setBusy(false); }
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero px-4">
      <form onSubmit={go} className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-soft">
        <Link to="/" className="font-display text-3xl text-primary">اختبرني</Link>
        <p className="mt-2 text-muted-foreground">اكتب الكود اللي إداك المدرس</p>
        <Input dir="ltr" className="mt-6 text-center font-mono text-xl tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={20} />
        <Button className="mt-4 w-full" disabled={busy}>{busy ? "جارٍ الدخول…" : "دخول"}</Button>
      </form>
    </div>
  );
}

function Portal({ s, onLogout }: { s: StudentSession; onLogout: () => void }) {
  const [tab, setTab] = useState<"exams" | "results">("exams");
  const exams = useQuery({ queryKey: ["st-exams", s.code], queryFn: () => studentExams({ data: { code: s.code } }) });
  const results = useQuery({ queryKey: ["st-results", s.code], queryFn: () => studentResults({ data: { code: s.code } }), enabled: tab === "results" });
  return (
    <div className="min-h-screen bg-background" style={subjectThemeVars(s.subject) as React.CSSProperties}>
      <header className="border-b bg-card/70">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <div className="font-display text-2xl text-primary">أهلاً {s.name}</div>
            <div className="text-sm text-muted-foreground">{s.groupName} · {subjectInfo(s.subject).label}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>خروج</Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        {s.welcome && <Panel className="bg-accent text-accent-foreground">{s.welcome}</Panel>}
        <div className="flex gap-2">
          <Button variant={tab === "exams" ? "default" : "outline"} onClick={() => setTab("exams")}>الامتحانات</Button>
          <Button variant={tab === "results" ? "default" : "outline"} onClick={() => setTab("results")}>نتايجي</Button>
        </div>
        {tab === "exams" && (
          <div className="grid gap-3 md:grid-cols-2">
            {exams.isLoading && <p className="text-muted-foreground">جارٍ التحميل…</p>}
            {exams.data?.length === 0 && <Panel className="text-muted-foreground">مفيش امتحانات متاحة دلوقتي.</Panel>}
            {exams.data?.map((e) => (
              <Panel key={e.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{e.title}</div>
                  <div className="text-sm text-muted-foreground">{e.count} سؤال · {e.duration_min} دقيقة{e.attempts ? ` · ${e.attempts} محاولة سابقة` : ""}</div>
                </div>
                <Link to="/student-exam/$id" params={{ id: e.id }}><Button>ابدأ</Button></Link>
              </Panel>
            ))}
          </div>
        )}
        {tab === "results" && (
          <div className="space-y-3">
            {results.data?.length === 0 && <Panel className="text-muted-foreground">لسه مفيش نتايج.</Panel>}
            {results.data?.map((r) => (
              <Panel key={r.id} className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{r.title}</div>
                  <div className="text-sm text-muted-foreground">محاولة {r.attempt_num} · {new Date(r.submitted_at).toLocaleString("ar-EG")}</div>
                </div>
                <div className="text-left">
                  {r.final_score === null ? (
                    <span className="text-muted-foreground">قيد التصحيح</span>
                  ) : (
                    <>
                      <div className="font-display text-xl">{r.final_score} / {r.max_score}</div>
                      <div className="text-sm text-muted-foreground">
                        {r.forced_zero ? "صفر بسبب الغش" : gradeLabel(r.max_score ? (Number(r.final_score) / r.max_score) * 100 : 0)}
                      </div>
                    </>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
