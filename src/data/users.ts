import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import type { User } from "@/db/schema";

type AdminRole = "admin" | "clerk" | "player";

export async function getUsersForAdmin(
  cashierId: string,
  roleFilter?: AdminRole
): Promise<User[]> {
  const roles: AdminRole[] = roleFilter ? [roleFilter] : ["admin", "clerk", "player"];
  return db
    .select()
    .from(users)
    .where(and(eq(users.cashierId, cashierId), inArray(users.role, roles)))
    .orderBy(users.createdAt);
}

export async function setUserActive(
  clerkId: string,
  isActive: boolean,
  cashierId: string
): Promise<void> {
  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(users.clerkId, clerkId), eq(users.cashierId, cashierId)));
}

export async function deleteUserByClerkId(
  clerkId: string,
  cashierId: string
): Promise<void> {
  await db
    .delete(users)
    .where(and(eq(users.clerkId, clerkId), eq(users.cashierId, cashierId)));
}
