import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_LABELS, subjectInfo } from "@/lib/subjects";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "لوحة الأدمن — اختبرني" }, { name: "description", content: "إدارة المدرسين والامتحانات والإعلانات." }, { property: "og:title", content: "لوحة الأدمن — اختبرني" }, { property: "og:description", content: "إدارة المدرسين والامتحانات والإعلانات." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

function Admin() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return null;
  if (!me.isAdmin) return <Navigate to="/home" replace />;
  return (
    <AppShell title="الأدمن">
      <Stats />
      <Tabs defaultValue="teachers" className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="teachers">المدرسين</TabsTrigger>
          <TabsTrigger value="exams">الامتحانات</TabsTrigger>
          <TabsTrigger value="students">الطلاب</TabsTrigger>
          <TabsTrigger value="subs">التسليمات</TabsTrigger>
          <TabsTrigger value="news">الإعلانات</TabsTrigger>
        </TabsList>
        <TabsContent value="teachers"><Teachers /></TabsContent>
        <TabsContent value="exams"><Simple table="exams" cols="id,title,status" label={(r) => `${r.title} · ${STATUS_LABELS[r.status as string]}`} /></TabsContent>
        <TabsContent value="students"><Simple table="students" cols="id,name,code,active" label={(r) => `${r.name} · ${r.code}${r.active ? "" : " (موقوف)"}`} /></TabsContent>
        <TabsContent value="subs"><Simple table="submissions" cols="id,final_score,max_score,submitted_at" order="submitted_at" label={(r) => `${r.final_score ?? "قيد التصحيح"} / ${r.max_score} · ${new Date(r.submitted_at as string).toLocaleString("ar-EG")}`} /></TabsContent>
        <TabsContent value="news"><News /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Stats() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const t = ["teachers", "students", "exams", "groups", "submissions"] as const;
      const r = await Promise.all(t.map((x) => supabase.from(x).select("id", { count: "exact", head: true })));
      return t.map((x, i) => ({ x, n: r[i]!.count ?? 0 }));
    },
  });
  const L: Record<string, string> = { teachers: "مدرس", students: "طالب", exams: "امتحان", groups: "مجموعة", submissions: "تسليم" };
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {data?.map((s) => <Panel key={s.x} className="text-center"><div className="font-display text-3xl text-primary">{s.n}</div><div className="text-sm text-muted-foreground">{L[s.x]}</div></Panel>)}
    </div>
  );
}

function Teachers() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-teachers"], queryFn: async () => (await supabase.from("teachers").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function setStatus(id: string, status: "active" | "rejected" | "suspended") {
    const { error } = await supabase.from("teachers").update({ status }).eq("id", id);
    if (error) toast.error("تعذر التحديث"); else qc.invalidateQueries({ queryKey: ["admin-teachers"] });
  }
  return (
    <div className="space-y-3">
      {data?.length === 0 && <Panel className="text-muted-foreground">لا يوجد مدرسين.</Panel>}
      {data?.map((t) => (
        <Panel key={t.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">{t.full_name} <Badge variant={t.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[t.status]}</Badge></div>
            <div className="text-sm text-muted-foreground" dir="auto">{subjectInfo(t.subject).label} · {t.phone} · {t.email}</div>
          </div>
          <div className="flex gap-2">
            {t.status !== "active" && <Button size="sm" onClick={() => setStatus(t.id, "active")}>قبول</Button>}
            {t.status === "pending" && <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "rejected")}>رفض</Button>}
            {t.status === "active" && <Button size="sm" variant="outline" onClick={() => setStatus(t.id, "suspended")}>إيقاف</Button>}
          </div>
        </Panel>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { id: string; [k: string]: any };

function Simple({ table, cols, label, order = "created_at" }: { table: "exams" | "students" | "submissions"; cols: string; label: (r: Row) => string; order?: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", table], queryFn: async () => ((await supabase.from(table).select(cols).order(order, { ascending: false }).limit(200)).data ?? []) as unknown as Row[] });
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {data?.length === 0 && <p className="p-4 text-muted-foreground">لا توجد بيانات.</p>}
      {data?.map((r) => (
        <div key={r.id as string} className="flex items-center justify-between px-4 py-2">
          <span>{label(r)}</span>
          <Button size="icon" variant="ghost" onClick={async () => { if (confirm("حذف؟")) { await supabase.from(table).delete().eq("id", r.id as string); qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); } }}><Trash2 /></Button>
        </div>
      ))}
    </div>
  );
}

function News() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data } = useQuery({ queryKey: ["announcements"], queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [] });
  async function add() {
    if (!title.trim() || !body.trim()) return;
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), body: body.trim() });
    if (error) { toast.error("تعذر النشر"); return; }
    setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["announcements"] });
  }
  return (
    <div className="space-y-3">
      <Panel className="space-y-3">
        <Input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="نص الإعلان" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button onClick={add}>نشر</Button>
      </Panel>
      {data?.map((a) => (
        <Panel key={a.id} className="flex justify-between gap-3">
          <div><div className="font-bold">{a.title}</div><p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p></div>
          <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("announcements").delete().eq("id", a.id); qc.invalidateQueries({ queryKey: ["announcements"] }); }}><Trash2 /></Button>
        </Panel>
      ))}
    </div>
  );
}
