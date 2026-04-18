// =============================================================================
// Master Auth — Session-based auth for /master/* routes (no Clerk)
// =============================================================================

import { cookies } from "next/headers";
import { db } from "@/db";
import { masterSessions } from "@/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

import { MASTER_SESSION_COOKIE } from "@/lib/auth/constants";
export { MASTER_SESSION_COOKIE };
const SESSION_DURATION_HOURS = 8;

function getMasterCredentials(): { email: string; password: string } {
  const email = process.env.MASTER_EMAIL;
  const password = process.env.MASTER_PASSWORD;
  if (!email || !password) {
    throw new Error("MASTER_EMAIL and MASTER_PASSWORD environment variables must be set.");
  }
  return { email, password };
}

// Supports both plaintext and bcrypt-hashed MASTER_PASSWORD env var.
// To migrate: set MASTER_PASSWORD to the bcrypt hash of the real password.
async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

export async function verifyMasterCredentials(email: string, password: string): Promise<boolean> {
  const creds = getMasterCredentials();
  if (email !== creds.email) return false;
  return comparePassword(password, creds.password);
}

export async function verifyMasterPassword(password: string): Promise<boolean> {
  const { password: stored } = getMasterCredentials();
  return comparePassword(password, stored);
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

export async function getMasterSessionData(
  token: string
): Promise<{ valid: true; actingCashierId: string | null } | { valid: false }> {
  if (!token) return { valid: false };

  const [session] = await db
    .select()
    .from(masterSessions)
    .where(eq(masterSessions.token, token))
    .limit(1);

  if (!session || session.expiresAt <= new Date()) return { valid: false };

  return { valid: true, actingCashierId: session.actingCashierId ?? null };
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

export async function purgeExpiredMasterSessions(): Promise<void> {
  await db
    .delete(masterSessions)
    .where(lt(masterSessions.expiresAt, sql`now()`));
}
