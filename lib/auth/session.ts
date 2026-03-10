import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { SessionData } from "./types";

/**
 * iron-session configuration for encrypted HTTP-only cookies.
 * Cookie name: 'rf-session' (requirements foundry session)
 * Max age: 7 days (aligned with Cognito refresh token lifetime)
 */
export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "rf-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days = 604800 seconds
  },
};

/**
 * Get the current session from encrypted cookies.
 * For use in server components, server actions, and API routes.
 *
 * @returns Typed iron-session instance with SessionData
 */
export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
