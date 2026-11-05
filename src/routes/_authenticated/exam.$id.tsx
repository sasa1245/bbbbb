import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QTYPE_LABELS, STATUS_LABELS, TEMPLATES } from "@/lib/subjects";
import type { Question, QType } from "@/lib/scoring";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exam/$id")({
  head: () => ({ meta: [{ title: "منشئ الامتحان — اختبرني" }, { name: "description", content: "ابنِ أسئلة الامتحان واربطه بمجموعاتك." }, { property: "og:title", content: "منشئ الامتحان — اختبرني" }, { property: "og:description", content: "ابنِ أسئلة الامتحان واربطه بمجموعاتك." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Builder,
});

const sel = "w-full rounded-md border bg-background px-3 py-2 text-sm";

function blank(type: QType): Question {
  const id = crypto.randomUUID().slice(0, 8);
  const base = { id, type, text: "", points: 1 };
  if (type === "mcq") return { ...base, options: ["", "", "", ""], correct: 0 };
  if (type === "tf") return { ...base, correct: true };
  if (type === "fill") return { ...base, correct: "" };
  if (type === "match") return { ...base, pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
  if (type === "order") return { ...base, items: ["", "", ""] };
  return base;
}

function Builder() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["exam", id],
    queryFn: async () => {
      const { data: exam } = await supabase.from("exams").select("*").eq("id", id).single();
      const [{ data: groups }, { data: links }] = await Promise.all([
        supabase.from("groups").select("id,name").eq("teacher_id", exam!.teacher_id),
        supabase.from("exam_groups").select("group_id").eq("exam_id", id),
      ]);
      return { exam: exam!, groups: groups ?? [], linked: (links ?? []).map((l) => l.group_id) };
    },
  });
  const [f, setF] = useState<{ title: string; template: string; duration_min: number; max_violations: number; status: string; scheduled_at: string; questions: Question[]; linked: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data && !f) setF({
      title: data.exam.title, template: data.exam.template, duration_min: data.exam.duration_min,
      max_violations: data.exam.max_violations, status: data.exam.status,
      scheduled_at: data.exam.scheduled_at ? data.exam.scheduled_at.slice(0, 16) : "",
      questions: data.exam.questions as unknown as Question[], linked: data.linked,
    });
  }, [data, f]);
  if (!data || !f) return null;

  const setQ = (i: number, patch: Partial<Question>) => setF({ ...f, questions: f.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
  const moveQ = (i: number, d: number) => {
    const qs = [...f.questions]; const j = i + d;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j]!, qs[i]!]; setF({ ...f, questions: qs });
  };

  async function save() {
    if (!f) return;
    if (f.status === "active" && !f.linked.length) { toast.error("اختار مجموعة واحدة على الأقل قبل التفعيل"); return; }
    setSaving(true);
    const { error } = await supabase.from("exams").update({
      title: f.title.trim() || "امتحان", template: f.template, duration_min: Math.max(1, f.duration_min),
      max_violations: Math.max(1, f.max_violations), status: f.status as "draft",
      scheduled_at: f.scheduled_at ? new Date(f.scheduled_at).toISOString() : null,
      questions: f.questions as never,
    }).eq("id", id);
    if (!error) {
      await supabase.from("exam_groups").delete().eq("exam_id", id);
      if (f.linked.length) await supabase.from("exam_groups").insert(f.linked.map((g) => ({ exam_id: id, group_id: g })));
    }
    setSaving(false);
    if (error) toast.error("تعذر الحفظ"); else { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["exams"] }); }
  }

  async function del() {
    if (!confirm("حذف الامتحان نهائياً؟")) return;
    await supabase.from("exams").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["exams"] });
    history.back();
  }

  return (
    <AppShell title="منشئ الامتحان" actions={<Link to="/results/$id" params={{ id }}><Button size="sm" variant="secondary">النتائج</Button></Link>}>
      <div className="space-y-6">
        <Panel className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2"><span className="text-sm">العنوان</span><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-sm">قالب العرض</span>
            <select className={sel} value={f.template} onChange={(e) => setF({ ...f, template: e.target.value })}>{TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm">الحالة</span>
            <select className={sel} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{["draft", "scheduled", "active", "closed"].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label>
          <label className="space-y-1"><span className="text-sm">المدة (دقيقة)</span><Input type="number" min={1} value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></label>
          <label className="space-y-1"><span className="text-sm">أقصى عدد مخالفات</span><Input type="number" min={1} value={f.max_violations} onChange={(e) => setF({ ...f, max_violations: Number(e.target.value) })} /></label>
          <label className="space-y-1 md:col-span-2"><span className="text-sm">موعد الجدولة</span><Input type="datetime-local" value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} /></label>
          <div className="md:col-span-2">
            <div className="mb-2 text-sm">المجموعات</div>
            <div className="flex flex-wrap gap-2">
              {data.groups.length === 0 && <span className="text-sm text-muted-foreground">اعمل مجموعة الأول من لوحة التحكم.</span>}
              {data.groups.map((g) => {
                const on = f.linked.includes(g.id);
                return <button key={g.id} type="button" onClick={() => setF({ ...f, linked: on ? f.linked.filter((x) => x !== g.id) : [...f.linked, g.id] })} className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : ""}`}>{g.name}</button>;
              })}
            </div>
          </div>
        </Panel>

        {f.questions.map((q, i) => (
          <Panel key={q.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold">{i + 1}. {QTYPE_LABELS[q.type]}</span>
              <div className="flex items-center gap-1">
                <Input type="number" min={0} className="w-20" value={q.points} onChange={(e) => setQ(i, { points: Number(e.target.value) })} />
                <span className="text-sm text-muted-foreground">درجة</span>
                <Button size="icon" variant="ghost" onClick={() => moveQ(i, -1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" onClick={() => moveQ(i, 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" onClick={() => setF({ ...f, questions: f.questions.filter((_, j) => j !== i) })}><Trash2 /></Button>
              </div>
            </div>
            <Textarea placeholder="نص السؤال" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
            <Input dir="ltr" placeholder="رابط صورة (اختياري)" value={q.media ?? ""} onChange={(e) => setQ(i, { media: e.target.value })} />
            {q.type === "mcq" && (q.options ?? []).map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" checked={q.correct === k} onChange={() => setQ(i, { correct: k })} />
                <Input placeholder={`الاختيار ${k + 1}`} value={o} onChange={(e) => setQ(i, { options: q.options!.map((x, m) => (m === k ? e.target.value : x)) })} />
              </div>
            ))}
            {q.type === "tf" && (
              <div className="flex gap-2">{[true, false].map((b) => <Button key={String(b)} type="button" variant={q.correct === b ? "default" : "outline"} onClick={() => setQ(i, { correct: b })}>{b ? "صح" : "خطأ"}</Button>)}</div>
            )}
            {q.type === "fill" && <Input placeholder="الإجابات المقبولة مفصولة بـ |" value={String(q.correct ?? "")} onChange={(e) => setQ(i, { correct: e.target.value })} />}
            {q.type === "essay" && <p className="text-sm text-muted-foreground">بيتصحح يدوياً من صفحة النتائج.</p>}
            {q.type === "match" && (
              <div className="space-y-2">
                {(q.pairs ?? []).map((p, k) => (
                  <div key={k} className="flex gap-2">
                    <Input placeholder="العمود الأول" value={p.left} onChange={(e) => setQ(i, { pairs: q.pairs!.map((x, m) => (m === k ? { ...x, left: e.target.value } : x)) })} />
                    <Input placeholder="ما يقابله" value={p.right} onChange={(e) => setQ(i, { pairs: q.pairs!.map((x, m) => (m === k ? { ...x, right: e.target.value } : x)) })} />
                    <Button size="icon" variant="ghost" onClick={() => setQ(i, { pairs: q.pairs!.filter((_, m) => m !== k) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setQ(i, { pairs: [...(q.pairs ?? []), { left: "", right: "" }] })}>+ زوج</Button>
              </div>
            )}
            {q.type === "order" && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">اكتب العناصر بالترتيب الصحيح، وهتتلخبط للطالب.</p>
                {(q.items ?? []).map((it, k) => (
                  <div key={k} className="flex gap-2">
                    <Input placeholder={`العنصر ${k + 1}`} value={it} onChange={(e) => setQ(i, { items: q.items!.map((x, m) => (m === k ? e.target.value : x)) })} />
                    <Button size="icon" variant="ghost" onClick={() => setQ(i, { items: q.items!.filter((_, m) => m !== k) })}><Trash2 /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setQ(i, { items: [...(q.items ?? []), ""] })}>+ عنصر</Button>
              </div>
            )}
          </Panel>
        ))}

        <Panel className="flex flex-wrap gap-2">
          <span className="self-center text-sm text-muted-foreground">إضافة سؤال:</span>
          {(Object.keys(QTYPE_LABELS) as QType[]).map((t) => <Button key={t} size="sm" variant="outline" onClick={() => setF({ ...f, questions: [...f.questions, blank(t)] })}>{QTYPE_LABELS[t]}</Button>)}
        </Panel>

        <div className="sticky bottom-4 flex justify-between gap-2 rounded-2xl border bg-card p-3 shadow-soft">
          <Button variant="ghost" onClick={del}><Trash2 /> حذف</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الامتحان"}</Button>
        </div>
      </div>
    </AppShell>
  );
}
