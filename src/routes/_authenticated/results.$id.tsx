import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { finalScore, gradeLabel, type Question } from "@/lib/scoring";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/results/$id")({
  head: () => ({ meta: [{ title: "نتائج الامتحان — اختبرني" }, { name: "description", content: "درجات الطلاب وتصحيح المقالي وسجل الغش." }, { property: "og:title", content: "نتائج الامتحان — اختبرني" }, { property: "og:description", content: "درجات الطلاب وتصحيح المقالي وسجل الغش." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Results,
});

function Results() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["results", id],
    queryFn: async () => {
      const { data: exam } = await supabase.from("exams").select("id,title,questions,teacher_id").eq("id", id).single();
      const [{ data: subs }, { data: students }] = await Promise.all([
        supabase.from("submissions").select("*").eq("exam_id", id).order("submitted_at", { ascending: false }),
        supabase.from("students").select("id,name").eq("teacher_id", exam!.teacher_id),
      ]);
      const names = Object.fromEntries((students ?? []).map((s) => [s.id, s.name]));
      return { exam: exam!, subs: subs ?? [], names };
    },
  });
  if (!data) return null;
  const questions = data.exam.questions as unknown as Question[];
  return (
    <AppShell title={`نتائج: ${data.exam.title}`} actions={<Link to="/exam/$id" params={{ id }}><Button size="sm" variant="outline">تعديل الامتحان</Button></Link>}>
      {data.subs.length === 0 && <Panel className="text-center text-muted-foreground">لسه مفيش تسليمات.</Panel>}
      <div className="space-y-3">
        {data.subs.map((s) => <SubRow key={s.id} sub={s} name={data.names[s.student_id] ?? "طالب محذوف"} questions={questions} examId={id} />)}
      </div>
    </AppShell>
  );
}

type Sub = { id: string; attempt_num: number; answers: unknown; cheat_log: unknown; essay_grades: unknown; auto_score: number; max_score: number; final_score: number | null; forced_zero: boolean; submitted_at: string };

function SubRow({ sub, name, questions, examId }: { sub: Sub; name: string; questions: Question[]; examId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [grades, setGrades] = useState<Record<string, number>>((sub.essay_grades ?? {}) as Record<string, number>);
  const answers = (sub.answers ?? {}) as Record<string, unknown>;
  const log = (Array.isArray(sub.cheat_log) ? sub.cheat_log : []) as { type: string; at: string }[];
  const essays = questions.filter((q) => q.type === "essay");
  async function saveGrades() {
    const final = finalScore(questions, Number(sub.auto_score), grades, sub.forced_zero);
    const { error } = await supabase.from("submissions").update({ essay_grades: grades as never, final_score: final, has_pending_essay: final === null }).eq("id", sub.id);
    if (error) toast.error("تعذر الحفظ"); else { toast.success("تم حفظ التصحيح"); qc.invalidateQueries({ queryKey: ["results", examId] }); }
  }
  const pct = sub.final_score !== null && sub.max_score ? (Number(sub.final_score) / sub.max_score) * 100 : null;
  return (
    <Panel>
      <button className="flex w-full items-center justify-between text-right" onClick={() => setOpen(!open)}>
        <div>
          <div className="font-bold">{name}</div>
          <div className="text-sm text-muted-foreground">محاولة {sub.attempt_num} · {new Date(sub.submitted_at).toLocaleString("ar-EG")}{log.length ? ` · ${log.length} مخالفة` : ""}</div>
        </div>
        <div className="text-left">
          {sub.final_score === null ? <span className="text-warning">قيد التصحيح</span> : (
            <><div className="font-display text-xl">{sub.final_score} / {sub.max_score}</div>
              <div className="text-xs text-muted-foreground">{sub.forced_zero ? "صفر — غش" : pct !== null ? gradeLabel(pct) : ""}</div></>
          )}
        </div>
      </button>
      {open && (
        <div className="mt-4 space-y-4 border-t pt-4">
          {essays.map((q) => (
            <div key={q.id} className="space-y-2">
              <div className="font-bold">{q.text} <span className="text-xs text-muted-foreground">({q.points} درجة)</span></div>
              <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{String(answers[q.id] ?? "— بدون إجابة —")}</p>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} className="w-24" value={grades[q.id] ?? ""} onChange={(e) => setGrades({ ...grades, [q.id]: Number(e.target.value) })} />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
          {essays.length > 0 && !sub.forced_zero && <Button onClick={saveGrades}>حفظ التصحيح</Button>}
          <div>
            <div className="mb-1 text-sm font-bold">سجل الغش</div>
            {log.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مخالفات.</p> : (
              <ul className="space-y-1 text-sm">{log.map((l, i) => <li key={i}>• {l.type} — {new Date(l.at).toLocaleTimeString("ar-EG")}</li>)}</ul>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
