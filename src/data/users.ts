import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
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
    .where(and(eq(cashierUsers.cashierId, cashierId), inArray(cashierUsers.role, roles)))
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
