import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/lib/use-me";

export function AppShell({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  const signOut = useSignOut();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/home" className="font-display text-2xl text-primary">اختبرني</Link>
            {title && <span className="text-muted-foreground">/ {title}</span>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="ghost" size="sm" onClick={signOut}>خروج</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-5 shadow-soft ${className}`}>{children}</div>;
}
