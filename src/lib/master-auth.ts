// =============================================================================
// Master Auth — Dual-path authentication for /master/* routes
//
// Path 1 (ENV ROOT): email === MASTER_EMAIL → validate against MASTER_PASSWORD
//   - Always active, cannot be disabled, not stored in DB
//   - Session: isEnvRoot=true, masterUserId=null, role="master_admin"
//
// Path 2 (DB USER): email !== MASTER_EMAIL → validate against users table
//   - Session: isEnvRoot=false, masterUserId=user.id, role=user.role
// =============================================================================

import { cookies } from "next/headers";
import { db } from "@/db";
import { masterSessions, masterUsers } from "@/db/schema";
import { eq, lt, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

import { MASTER_SESSION_COOKIE } from "@/lib/auth/constants";
import type { MasterRole, MasterSession } from "@/lib/auth/types";
export { MASTER_SESSION_COOKIE };

const SESSION_DURATION_HOURS = 8;

// ---------------------------------------------------------------------------
// Credential verification
// ---------------------------------------------------------------------------

function getMasterEnvCredentials(): { email: string; password: string } {
  const email = process.env.MASTER_EMAIL;
  const password = process.env.MASTER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "MASTER_EMAIL and MASTER_PASSWORD environment variables must be set.",
    );
  }
  return { email, password };
}

async function comparePassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}

export type LoginResult =
  | { success: true; isEnvRoot: boolean; masterUserId: string | null; role: MasterRole }
  | { success: false; reason: string };

export async function verifyMasterCredentials(
  email: string,
  password: string,
): Promise<LoginResult> {
  const envCreds = getMasterEnvCredentials();

  // Path 1: ENV ROOT account
  if (email.toLowerCase() === envCreds.email.toLowerCase()) {
    const valid = await comparePassword(password, envCreds.password);
    if (!valid) return { success: false, reason: "Invalid credentials" };
    return { success: true, isEnvRoot: true, masterUserId: null, role: "master_admin" };
  }

  // Path 2: DB users table
  const [user] = await db
    .select()
    .from(masterUsers)
    .where(eq(masterUsers.email, email.toLowerCase()))
    .limit(1);

  if (!user) return { success: false, reason: "Invalid credentials" };
  if (!user.isActive) return { success: false, reason: "Account is inactive" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { success: false, reason: "Invalid credentials" };

  // Update last_login
  await db
    .update(masterUsers)
    .set({ lastLogin: new Date(), updatedAt: new Date() })
    .where(eq(masterUsers.id, user.id));

  return {
    success: true,
    isEnvRoot: false,
    masterUserId: user.id,
    role: user.role as MasterRole,
  };
}

// Legacy: used by verifyMasterPassword for cashier delete confirmation
export async function verifyMasterPassword(password: string): Promise<boolean> {
  const { password: stored } = getMasterEnvCredentials();
  return comparePassword(password, stored);
}

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export async function createMasterSession(opts: {
  isEnvRoot: boolean;
  masterUserId: string | null;
  role: MasterRole;
}): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.insert(masterSessions).values({
    token,
    expiresAt,
    masterUserId: opts.masterUserId,
    loginSource: opts.isEnvRoot ? "env" : "db",
  });

  return token;
}

// ---------------------------------------------------------------------------
// Session validation & retrieval
// ---------------------------------------------------------------------------

export async function validateMasterSession(token: string): Promise<boolean> {
  if (!token) return false;

  const [session] = await db
    .select()
    .from(masterSessions)
    .where(eq(masterSessions.token, token))
    .limit(1);

  if (!session) return false;

  const expires =
    session.expiresAt instanceof Date
      ? session.expiresAt
      : new Date(session.expiresAt as unknown as string);

  return expires.getTime() > Date.now();
}

export async function getMasterSessionData(token: string): Promise<MasterSession | null> {
  if (!token) return null;

  const [session] = await db
    .select()
    .from(masterSessions)
    .where(eq(masterSessions.token, token))
    .limit(1);

  if (!session) return null;

  const expires =
    session.expiresAt instanceof Date
      ? session.expiresAt
      : new Date(session.expiresAt as unknown as string);

  if (expires.getTime() <= Date.now()) return null;

  const isEnvRoot = session.loginSource === "env";
  let role: MasterRole = "master_admin"; // env root is always master_admin

  if (!isEnvRoot && session.masterUserId) {
    const [user] = await db
      .select({ role: masterUsers.role, isActive: masterUsers.isActive })
      .from(masterUsers)
      .where(eq(masterUsers.id, session.masterUserId))
      .limit(1);
    if (!user || !user.isActive) return null; // User deactivated
    role = user.role as MasterRole;
  }

  return {
    type: "master",
    sessionToken: token,
    isEnvRoot,
    masterUserId: session.masterUserId ?? null,
    role,
    actingCashierId: session.actingCashierId ?? undefined,
    actingRole: (session.actingRole as "admin" | "clerk" | "player" | undefined) ?? undefined,
  };
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
  await db.delete(masterSessions).where(lt(masterSessions.expiresAt, sql`now()`));
}

// ---------------------------------------------------------------------------
// Master user lookup (for session hydration)
// ---------------------------------------------------------------------------

export async function getMasterUserById(id: string) {
  const [user] = await db
    .select()
    .from(masterUsers)
    .where(eq(masterUsers.id, id))
    .limit(1);
  return user ?? null;
}

export async function hashMasterPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}
