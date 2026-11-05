import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { checkAndAssignAdminRole } from "@/lib/admin.functions";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user!;

      // Auto-assign admin role if email matches VITE_ADMIN_EMAIL (idempotent)
      if (user.email) {
        try {
          await checkAndAssignAdminRole({ data: { userId: user.id, userEmail: user.email } });
        } catch {
          // Graceful degradation — don't block the user if admin check fails
        }
      }

      const [{ data: roles }, { data: teacher }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("teachers").select("*").eq("id", user.id).maybeSingle(),
      ]);
      return {
        user,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
        teacher,
      };
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}
