/**
 * Pure utilities for admin email detection.
 * Kept separate from admin.functions.ts so they can be unit-tested
 * without pulling in server-only imports (client.server, createServerFn).
 */

/** Reads VITE_ADMIN_EMAIL from environment and normalizes it (trim + lowercase). */
export function getAdminEmail(): string | null {
  const email = process.env.VITE_ADMIN_EMAIL;
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed || null;
}

/** Returns true if the two emails match after normalization. */
export function emailsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
