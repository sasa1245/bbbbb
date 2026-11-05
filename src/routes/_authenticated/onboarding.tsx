import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUBJECTS } from "@/lib/subjects";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "بيانات المدرس — اختبرني" }, { name: "description", content: "أكمل بياناتك كمدرس" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState((user.user_metadata?.["full_name"] as string) ?? "");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("physics");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) { toast.error("اكتب الاسم ورقم التليفون"); return; }
    setBusy(true);
    const { error } = await supabase
      .from("teachers")
      .insert({ id: user.id, email: user.email ?? null, full_name: name.trim(), phone: phone.trim(), subject });
    setBusy(false);
    if (error) { toast.error("تعذر الحفظ"); return; }
    await qc.invalidateQueries({ queryKey: ["me"] });
    navigate({ to: "/home" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-lg space-y-5 rounded-3xl border bg-card p-8 shadow-soft">
        <h1 className="font-display text-3xl">أهلاً بيك في اختبرني</h1>
        <p className="text-muted-foreground">عرّفنا بنفسك عشان نفعّل حسابك.</p>
        <div className="space-y-2">
          <Label>الاسم</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>
        <div className="space-y-2">
          <Label>رقم التليفون</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" maxLength={20} />
        </div>
        <div className="space-y-2">
          <Label>المادة</Label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                type="button"
                key={s.key}
                onClick={() => setSubject(s.key)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${subject === s.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>إرسال الطلب</Button>
      </form>
    </div>
  );
}
