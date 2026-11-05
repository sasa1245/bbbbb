import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { AppShell, Panel } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, subjectInfo } from "@/lib/subjects";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة المدرس — اختبرني" }, { name: "description", content: "إدارة المجموعات والطلاب والامتحانات" }] }),
  component: Dashboard,
});

function genCode() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => c[b % c.length]!).join("");
}

function Dashboard() {
  const { data: me, isLoading } = useMe();
  if (isLoading || !me) return null;
  if (!me.teacher || me.teacher.status !== "active") return <Navigate to="/home" replace />;
  return (
    <AppShell title={`${me.teacher.full_name} · ${subjectInfo(me.teacher.subject).label}`}>
      <Tabs defaultValue="exams">
        <TabsList className="mb-6">
          <TabsTrigger value="exams">الامتحانات</TabsTrigger>
          <TabsTrigger value="groups">المجموعات والطلاب</TabsTrigger>
          <TabsTrigger value="news">الإعلانات</TabsTrigger>
        </TabsList>
        <TabsContent value="exams"><Exams teacherId={me.user.id} /></TabsContent>
        <TabsContent value="groups"><Groups teacherId={me.user.id} /></TabsContent>
        <TabsContent value="news"><News /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Exams({ teacherId }: { teacherId: string }) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["exams", teacherId],
    queryFn: async () =>
      (await supabase.from("exams").select("id,title,status,duration_min,questions,created_at").eq("teacher_id", teacherId).order("created_at", { ascending: false })).data ?? [],
  });
  async function create(): Promise<void> {
    const { data: e, error } = await supabase.from("exams").insert({ teacher_id: teacherId, title: "امتحان جديد" }).select("id").single();
    if (error || !e) { toast.error("تعذر الإنشاء"); return; }
    navigate({ to: "/exam/$id", params: { id: e.id } });
  }
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="font-display text-2xl">امتحاناتك</h2>
        <Button onClick={create}>+ امتحان جديد</Button>
      </div>
      {data?.length === 0 && <Panel className="text-center text-muted-foreground">لسه ما عملتش امتحانات.</Panel>}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((e) => (
          <Panel key={e.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">{e.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {(e.questions as unknown[]).length} سؤال · {e.duration_min} دقيقة
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={e.status === "active" ? "default" : "secondary"}>{STATUS_LABELS[e.status]}</Badge>
              <Link to="/exam/$id" params={{ id: e.id }}><Button size="sm" variant="outline">تعديل</Button></Link>
              <Link to="/results/$id" params={{ id: e.id }}><Button size="sm" variant="secondary">النتائج</Button></Link>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Groups({ teacherId }: { teacherId: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [welcome, setWelcome] = useState("");
  const { data: groups } = useQuery({
    queryKey: ["groups", teacherId],
    queryFn: async () => (await supabase.from("groups").select("*").eq("teacher_id", teacherId).order("created_at")).data ?? [],
  });
  const { data: students } = useQuery({
    queryKey: ["students", teacherId],
    queryFn: async () => (await supabase.from("students").select("*").eq("teacher_id", teacherId).order("created_at")).data ?? [],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["groups", teacherId] });
    qc.invalidateQueries({ queryKey: ["students", teacherId] });
  };
  async function addGroup(): Promise<void> {
    if (!name.trim()) return;
    const { error } = await supabase.from("groups").insert({ teacher_id: teacherId, name: name.trim(), welcome_message: welcome.trim() || null });
    if (error) { toast.error("تعذر الإضافة"); return; }
    setName(""); setWelcome(""); refresh();
  }
  return (
    <div className="space-y-6">
      <Panel className="space-y-3">
        <h3 className="font-bold">مجموعة جديدة</h3>
        <Input placeholder="اسم المجموعة (فصل أو سنتر)" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea placeholder="رسالة ترحيب (اختياري)" value={welcome} onChange={(e) => setWelcome(e.target.value)} />
        <Button onClick={addGroup}>إضافة المجموعة</Button>
      </Panel>
      {groups?.map((g) => (
        <GroupCard key={g.id} group={g} teacherId={teacherId} students={(students ?? []).filter((s) => s.group_id === g.id)} onChange={refresh} />
      ))}
    </div>
  );
}

function GroupCard({ group, teacherId, students, onChange }: { group: { id: string; name: string; welcome_message: string | null }; teacherId: string; students: { id: string; name: string; code: string; active: boolean }[]; onChange: () => void }) {
  const [sname, setSname] = useState("");
  async function addStudent() {
    if (!sname.trim()) return;
    for (let i = 0; i < 3; i++) {
      const { error } = await supabase.from("students").insert({ teacher_id: teacherId, group_id: group.id, name: sname.trim(), code: genCode() });
      if (!error) { setSname(""); onChange(); return; }
    }
    toast.error("تعذر إضافة الطالب");
  }
  return (
    <Panel>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-display text-xl">{group.name}</h3>
          {group.welcome_message && <p className="text-sm text-muted-foreground">{group.welcome_message}</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={async () => { if (confirm("حذف المجموعة وكل طلابها؟")) { await supabase.from("groups").delete().eq("id", group.id); onChange(); } }}>
          <Trash2 />
        </Button>
      </div>
      <div className="mb-4 flex gap-2">
        <Input placeholder="اسم الطالب" value={sname} onChange={(e) => setSname(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStudent()} />
        <Button onClick={addStudent}>إضافة طالب</Button>
      </div>
      <div className="divide-y">
        {students.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-2">
            <span className={s.active ? "" : "text-muted-foreground line-through"}>{s.name}</span>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-mono text-sm" dir="ltr" onClick={() => { navigator.clipboard.writeText(s.code); toast.success("تم نسخ الكود"); }}>
                {s.code} <Copy className="h-3 w-3" />
              </button>
              <Switch checked={s.active} onCheckedChange={async (v) => { await supabase.from("students").update({ active: v }).eq("id", s.id); onChange(); }} />
              <Button variant="ghost" size="icon" onClick={async () => { if (confirm("حذف الطالب؟")) { await supabase.from("students").delete().eq("id", s.id); onChange(); } }}><Trash2 /></Button>
            </div>
          </div>
        ))}
        {students.length === 0 && <p className="py-2 text-sm text-muted-foreground">لا يوجد طلاب بعد.</p>}
      </div>
    </Panel>
  );
}

function News() {
  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="space-y-3">
      {data?.length === 0 && <Panel className="text-muted-foreground">لا توجد إعلانات.</Panel>}
      {data?.map((a) => (
        <Panel key={a.id}>
          <div className="font-bold">{a.title}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
        </Panel>
      ))}
    </div>
  );
}
