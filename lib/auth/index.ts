import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";

export type { UserInfo } from "./types";
export { getSession } from "./session";

/**
 * Get the current authenticated user's info.
 * Redirects to landing page (/) if not authenticated.
 *
 * Use this in server components and server actions as defense-in-depth
 * (per CVE-2025-29927: do not rely solely on proxy/middleware for auth).
 *
 * @returns UserInfo with sub, email, name, groups
 */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session.user) {
    redirect("/");
  }
  return session.user;
}
