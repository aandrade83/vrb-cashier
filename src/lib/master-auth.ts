// =============================================================================
// Master Auth — Session-based auth for /master/* routes (no Clerk)
// Credentials are hardcoded temporarily.
// =============================================================================

import { cookies } from "next/headers";
import { db } from "@/db";
import { masterSessions } from "@/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// Hardcoded master credentials (temporary)
const MASTER_EMAIL = "developervrb506@gmail.com";
const MASTER_PASSWORD = "VRB506Dev";

export const MASTER_SESSION_COOKIE = "master_session";
const SESSION_DURATION_HOURS = 8;

export function verifyMasterCredentials(email: string, password: string): boolean {
  return email === MASTER_EMAIL && password === MASTER_PASSWORD;
}

export async function createMasterSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.insert(masterSessions).values({ token, expiresAt });

  return token;
}

export async function validateMasterSession(token: string): Promise<boolean> {
  if (!token) return false;

  const [session] = await db
    .select()
    .from(masterSessions)
    .where(eq(masterSessions.token, token))
    .limit(1);

  if (!session) return false;

  return session.expiresAt > new Date();
}

export async function getMasterSessionFromCookies(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(MASTER_SESSION_COOKIE)?.value;
}

export async function isMasterAuthenticated(): Promise<boolean> {
  const token = await getMasterSessionFromCookies();
  if (!token) return false;
  return validateMasterSession(token);
}

export async function deleteMasterSession(token: string): Promise<void> {
  await db.delete(masterSessions).where(eq(masterSessions.token, token));
}

// Clean up expired sessions (call periodically)
export async function purgeExpiredMasterSessions(): Promise<void> {
  await db
    .delete(masterSessions)
    .where(lt(masterSessions.expiresAt, sql`now()`));
}
