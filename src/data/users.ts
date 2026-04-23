import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";
import type { CashierUser } from "@/db/schema";

type CashierRole = "admin" | "clerk" | "player";

export async function getUsersForAdmin(
  cashierId: string,
  roleFilter?: CashierRole
): Promise<CashierUser[]> {
  const roles: CashierRole[] = roleFilter ? [roleFilter] : ["admin", "clerk", "player"];
  return db
    .select()
    .from(cashierUsers)
    .where(
      and(
        eq(cashierUsers.cashierId, cashierId),
        inArray(cashierUsers.role, roles),
        // Exclude master shadow accounts (__m__* and __mp__* prefixes)
        sql`LEFT(${cashierUsers.username}, 3) != '__m'`,
      ),
    )
    .orderBy(cashierUsers.createdAt);
}

export async function getUserById(
  userId: string,
  cashierId: string
): Promise<CashierUser | null> {
  const [user] = await db
    .select()
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return user ?? null;
}

export async function getUserByUsername(
  username: string,
  cashierId: string
): Promise<CashierUser | null> {
  const [user] = await db
    .select()
    .from(cashierUsers)
    .where(and(eq(cashierUsers.username, username.toLowerCase()), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return user ?? null;
}

export async function createUser(data: {
  cashierId: string;
  username: string;
  passwordHash: string;
  role: CashierRole;
  email?: string;
  firstName?: string;
  lastName?: string;
  createdByAdminId?: string;
}): Promise<CashierUser> {
  const [user] = await db
    .insert(cashierUsers)
    .values({
      cashierId: data.cashierId,
      username: data.username.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role,
      email: data.email ?? null,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      createdByAdminId: data.createdByAdminId ?? null,
    })
    .returning();
  return user;
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  cashierId: string
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}

export async function deleteUser(
  userId: string,
  cashierId: string
): Promise<void> {
  await db
    .delete(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(cashierUsers.id, userId));
}

// =============================================================================
// EMAIL VERIFICATION
// =============================================================================

type VerificationStatus = Pick<
  CashierUser,
  | "email"
  | "emailVerified"
  | "verificationCode"
  | "verificationExpiresAt"
  | "verificationAttempts"
  | "verificationLastSentAt"
>;

export async function getPlayerVerificationStatus(
  userId: string,
  cashierId: string,
): Promise<VerificationStatus | null> {
  const [row] = await db
    .select({
      email: cashierUsers.email,
      emailVerified: cashierUsers.emailVerified,
      verificationCode: cashierUsers.verificationCode,
      verificationExpiresAt: cashierUsers.verificationExpiresAt,
      verificationAttempts: cashierUsers.verificationAttempts,
      verificationLastSentAt: cashierUsers.verificationLastSentAt,
    })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}

export async function saveVerificationCode(
  userId: string,
  cashierId: string,
  email: string,
  code: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({
      email,
      verificationCode: code,
      verificationExpiresAt: expiresAt,
      verificationAttempts: 0,
      verificationLastSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}

export async function markEmailVerified(
  userId: string,
  cashierId: string,
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({
      emailVerified: true,
      emailVerifiedAt: new Date(),
      verificationCode: null,
      verificationExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}

export async function incrementVerificationAttempts(
  userId: string,
  cashierId: string,
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({
      verificationAttempts: sql`${cashierUsers.verificationAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}

export async function resetEmailVerification(
  userId: string,
  cashierId: string,
): Promise<void> {
  await db
    .update(cashierUsers)
    .set({
      email: null,
      emailVerified: false,
      emailVerifiedAt: null,
      verificationCode: null,
      verificationExpiresAt: null,
      verificationAttempts: 0,
      verificationLastSentAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)));
}
