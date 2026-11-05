import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe, useSignOut } from "@/lib/use-me";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "اختبرني" }, { name: "description", content: "حسابك على اختبرني" }] }),
  component: Home,
});

function Home() {
  const { data, isLoading } = useMe();
  const signOut = useSignOut();
  if (isLoading || !data) return <div className="p-10 text-center text-muted-foreground">جارٍ التحميل…</div>;
  if (data.isAdmin) return <Navigate to="/admin" replace />;
  if (!data.teacher) return <Navigate to="/onboarding" replace />;
  if (data.teacher.status === "active") return <Navigate to="/dashboard" replace />;
  const msg =
    data.teacher.status === "pending"
      ? { t: "طلبك قيد المراجعة", d: "هنراجع بياناتك ونفعّل حسابك في أقرب وقت." }
      : data.teacher.status === "rejected"
        ? { t: "تم رفض طلبك", d: "تواصل مع إدارة المنصة لمزيد من التفاصيل." }
        : { t: "حسابك موقوف", d: "تواصل مع إدارة المنصة لإعادة التفعيل." };
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero px-4">
      <div className="max-w-md rounded-3xl border bg-card p-10 text-center shadow-soft">
        <div className="mx-auto mb-6 h-3 w-3 animate-pulse rounded-full bg-warning" />
        <h1 className="font-display text-3xl">{msg.t}</h1>
        <p className="mt-3 text-muted-foreground">{msg.d}</p>
        <Button variant="outline" className="mt-8" onClick={signOut}>خروج</Button>
      </div>
    </div>
  );
}
