import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول المدرسين — اختبرني" },
      { name: "description", content: "سجّل دخولك بحساب جوجل لإدارة امتحاناتك وطلابك." },
      { property: "og:title", content: "دخول المدرسين — اختبرني" },
      { property: "og:description", content: "سجّل دخولك بحساب جوجل لإدارة امتحاناتك." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const err = p.get("error_description") || p.get("error");
    if (err) setAuthError(err);
  }, []);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" && s) navigate({ to: "/home", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) {
      toast.error("تعذر تسجيل الدخول");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-hero px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-soft">
        <Link to="/" className="font-display text-3xl text-primary">اختبرني</Link>
        <p className="mt-3 text-muted-foreground">دخول المدرسين وإدارة المنصة</p>
        {authError && (
          <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{authError}</p>
        )}
        <Button onClick={google} disabled={busy} size="lg" className="mt-8 w-full">
          الدخول بحساب جوجل
        </Button>
        <Link to="/student" className="mt-6 block text-sm text-muted-foreground underline">
          طالب؟ ادخل بالكود
        </Link>
      </div>
    </div>
  );
}
