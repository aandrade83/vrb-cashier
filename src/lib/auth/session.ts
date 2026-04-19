import { cookies } from "next/headers";
import { db } from "@/db";
import { userSessions, masterSessions } from "@/db/schema";
import { eq, lt, sql, and } from "drizzle-orm";
import { randomBytes } from "crypto";
import { USER_SESSION_COOKIE, MASTER_SESSION_COOKIE } from "./constants";
import type { AuthSession, UserSession, MasterSession, UserRole } from "./types";
export { USER_SESSION_COOKIE, MASTER_SESSION_COOKIE } from "./constants";

const SESSION_DURATION = {
  player: 24 * 60 * 60 * 1000,
  clerk: 12 * 60 * 60 * 1000,
  admin: 12 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Create / destroy user sessions
// ---------------------------------------------------------------------------

export async function createUserSession(
  userId: string,
  cashierId: string,
  role: UserRole
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const durationMs = SESSION_DURATION[role];
  const expiresAt = new Date(Date.now() + durationMs);

  await db.insert(userSessions).values({ token, userId, cashierId, role, expiresAt });

  // Clean up expired sessions for this user on every login
  await purgeExpiredUserSessionsForUser(userId);

  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyUserSession(token: string): Promise<void> {
  await db.delete(userSessions).where(eq(userSessions.token, token));
}

export async function purgeExpiredUserSessions(): Promise<void> {
  await db.delete(userSessions).where(lt(userSessions.expiresAt, sql`now()`));
}

async function purgeExpiredUserSessionsForUser(userId: string): Promise<void> {
  await db
    .delete(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        lt(userSessions.expiresAt, sql`now()`)
      )
    );
}

// ---------------------------------------------------------------------------
// Read sessions from cookies
// ---------------------------------------------------------------------------

export async function getUserSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(userSessions)
    .where(eq(userSessions.token, token))
    .limit(1);

  if (!session || session.expiresAt <= new Date()) return null;

  return {
    type: "cashier",
    sessionToken: session.token,
    userId: session.userId,
    cashierId: session.cashierId,
    role: session.role as UserRole,
  };
}

export async function getMasterSession(): Promise<MasterSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MASTER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db
    .select()
    .from(masterSessions)
    .where(eq(masterSessions.token, token))
    .limit(1);

  if (!session || session.expiresAt <= new Date()) return null;

  return {
    type: "master",
    sessionToken: session.token,
    actingCashierId: session.actingCashierId ?? undefined,
  };
}

export async function getSession(): Promise<AuthSession | null> {
  const userSession = await getUserSession();
  if (userSession) return userSession;
  return getMasterSession();
}

// ---------------------------------------------------------------------------
// Master acting-cashier context
// ---------------------------------------------------------------------------

export async function setMasterActingCashier(
  masterToken: string,
  cashierId: string | null
): Promise<void> {
  await db
    .update(masterSessions)
    .set({ actingCashierId: cashierId })
    .where(eq(masterSessions.token, masterToken));
}

// ---------------------------------------------------------------------------
// Role resolution — returns the effective role a session has for a given cashier
// ---------------------------------------------------------------------------

export async function getEffectiveRoleForCashier(
  session: AuthSession,
  cashierId: string
): Promise<UserRole | null> {
  if (session.type === "cashier") {
    if (session.cashierId !== cashierId) return null;
    return session.role;
  }

  // Master acting as admin inside this specific cashier
  if (session.type === "master" && session.actingCashierId === cashierId) {
    return "admin";
  }

  return null;
}

// ---------------------------------------------------------------------------
// Convenience helper for server actions — resolves effective access for a cashier
// ---------------------------------------------------------------------------

export type CashierAccess = {
  role: UserRole;
  userId: string | null;
  isMasterActing: boolean;
};

export async function getSessionForCashier(
  cashierId: string
): Promise<CashierAccess | null> {
  const userSession = await getUserSession();
  if (userSession && userSession.cashierId === cashierId) {
    return {
      role: userSession.role,
      userId: userSession.userId,
      isMasterActing: false,
    };
  }

  const masterSession = await getMasterSession();
  if (masterSession && masterSession.actingCashierId === cashierId) {
    return { role: "admin", userId: null, isMasterActing: true };
  }

  return null;
}
