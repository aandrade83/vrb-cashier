import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { User } from "@/db/schema";

type AdminRole = "admin" | "clerk" | "player";

export async function getUsersForAdmin(
  roleFilter?: AdminRole
): Promise<User[]> {
  const roles: AdminRole[] = roleFilter ? [roleFilter] : ["admin", "clerk", "player"];
  return db
    .select()
    .from(users)
    .where(inArray(users.role, roles))
    .orderBy(users.createdAt);
}

export async function setUserActive(
  clerkId: string,
  isActive: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId));
}

export async function deleteUserByClerkId(clerkId: string): Promise<void> {
  await db.delete(users).where(eq(users.clerkId, clerkId));
}
