import { createServerFn } from "@tanstack/react-start";
import { getAdminEmail, emailsMatch } from "./admin-email";

export { getAdminEmail } from "./admin-email";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Checks if the authenticated user's email matches the admin email env var.
 * If it matches and no admin role exists, creates one automatically.
 * Idempotent: calling multiple times results in exactly one role record.
 */
export const checkAndAssignAdminRole = createServerFn({ method: "POST" })
  .inputValidator((i: { userId: string; userEmail: string }) => ({
    userId: String(i.userId),
    userEmail: String(i.userEmail),
  }))
  .handler(async ({ data }) => {
    const adminEmail = getAdminEmail();
    if (!adminEmail) return { isAdmin: false };

    if (!emailsMatch(data.userEmail, adminEmail)) return { isAdmin: false };

    const db = await adminClient();

    // Check if admin role already exists (idempotency)
    const { data: existing } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (existing) return { isAdmin: true };

    // Assign admin role
    const { error } = await db
      .from("user_roles")
      .insert({ user_id: data.userId, role: "admin" });

    if (error) {
      console.error("[admin-auto-detection] Failed to assign admin role:", error.message);
      return { isAdmin: false };
    }

    console.log(`[admin-auto-detection] Admin role assigned to: ${data.userEmail}`);
    return { isAdmin: true };
  });
