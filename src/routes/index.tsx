import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, KeyRound, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "اختبرني — امتحن طلابك أونلاين بدون حسابات" },
      { name: "description", content: "المدرس يبني الامتحان، والطالب يدخل بكود بسيط ويمتحن تحت مراقبة ضد الغش، والتصحيح تلقائي." },
      { property: "og:title", content: "اختبرني — امتحن طلابك أونلاين" },
      { property: "og:description", content: "امتحانات أونلاين للمدرسين والسناتر بكود للطالب، تصحيح تلقائي ومضاد للغش." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: KeyRound, t: "دخول بكود", d: "الطالب يدخل بكود فريد من غير إيميل ولا باسورد." },
  { icon: ShieldCheck, t: "مضاد للغش", d: "مراقبة التاب والتركيز والشاشة الكاملة، وسجل لكل مخالفة." },
  { icon: Sparkles, t: "تصحيح تلقائي", d: "ستة أنواع أسئلة تتصحح فوراً، والمقالي يدوياً بنسبة." },
  { icon: Users, t: "مجموعات", d: "قسّم طلابك لفصول أو سناتر ووزّع الامتحانات عليهم." },
];

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-2xl text-primary">اختبرني</span>
        <Link to="/auth">
          <Button variant="ghost">دخول المدرسين</Button>
        </Link>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <section className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1 text-sm text-accent-foreground">
            للمدرس الخاص ومدرسي السناتر
          </p>
          <h1 className="font-display text-5xl leading-tight text-foreground md:text-7xl">
            امتحن طلابك أونلاين،
            <br />
            <span className="text-primary">من غير حسابات ولا غش.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            ابنِ الامتحان في دقائق، وزّعه على مجموعاتك، وخلي الطالب يدخل بكوده ويمتحن والتصحيح يحصل لوحده.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/student">
              <Button size="lg" className="h-14 px-10 text-lg">أنا طالب — ادخل بالكود</Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg">أنا مدرس</Button>
            </Link>
          </div>
        </section>
        <section className="mt-24 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-6 shadow-soft">
              <f.icon className="mb-4 h-7 w-7 text-primary" />
              <h3 className="text-lg font-bold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
