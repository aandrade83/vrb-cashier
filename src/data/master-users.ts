import { db } from "@/db";
import { masterUsers, userCashierPermissions, cashiers } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { MasterUser } from "@/db/schema";

// =============================================================================
// READS
// =============================================================================

export async function getAllMasterUsers(): Promise<MasterUser[]> {
  return db
    .select()
    .from(masterUsers)
    .orderBy(masterUsers.createdAt);
}

export async function getMasterUserByEmail(email: string): Promise<MasterUser | null> {
  const [user] = await db
    .select()
    .from(masterUsers)
    .where(eq(masterUsers.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

export async function getMasterUserByUsername(username: string): Promise<MasterUser | null> {
  const [user] = await db
    .select()
    .from(masterUsers)
    .where(eq(masterUsers.username, username.toLowerCase()))
    .limit(1);
  return user ?? null;
}

// =============================================================================
// WRITES
// =============================================================================

export async function createMasterUser(data: {
  email: string;
  username: string;
  passwordHash: string;
  role: "master_admin" | "master_clerk";
  mustResetPassword?: boolean;
}): Promise<string> {
  const [user] = await db
    .insert(masterUsers)
    .values({
      email: data.email.toLowerCase(),
      username: data.username.toLowerCase(),
      passwordHash: data.passwordHash,
      role: data.role,
      mustResetPassword: data.mustResetPassword ?? false,
    })
    .returning({ id: masterUsers.id });
  return user.id;
}

export async function setMasterUserActive(id: string, isActive: boolean): Promise<void> {
  await db
    .update(masterUsers)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(masterUsers.id, id));
}

export async function updateMasterUserPassword(id: string, passwordHash: string): Promise<void> {
  await db
    .update(masterUsers)
    .set({ passwordHash, mustResetPassword: false, updatedAt: new Date() })
    .where(eq(masterUsers.id, id));
}

export async function deleteMasterUser(id: string): Promise<void> {
  await db.delete(masterUsers).where(eq(masterUsers.id, id));
}

// =============================================================================
// CASHIER PERMISSIONS
// =============================================================================

export type CashierPermissionRow = {
  cashierId: string;
  cashierName: string;
  assigned: boolean;
};

export async function getAllCashiersWithPermissionStatus(
  masterUserId: string,
): Promise<CashierPermissionRow[]> {
  const allCashiers = await db
    .select({ id: cashiers.id, name: cashiers.name })
    .from(cashiers)
    .orderBy(cashiers.name);

  const perms = await db
    .select({ cashierId: userCashierPermissions.cashierId })
    .from(userCashierPermissions)
    .where(eq(userCashierPermissions.masterUserId, masterUserId));

  const assignedSet = new Set(perms.map((p) => p.cashierId));

  return allCashiers.map((c) => ({
    cashierId: c.id,
    cashierName: c.name,
    assigned: assignedSet.has(c.id),
  }));
}

export async function getUserCashierPermissions(masterUserId: string): Promise<string[]> {
  const rows = await db
    .select({ cashierId: userCashierPermissions.cashierId })
    .from(userCashierPermissions)
    .where(eq(userCashierPermissions.masterUserId, masterUserId));
  return rows.map((r) => r.cashierId);
}

export async function getClerkEmailsForCashier(cashierId: string): Promise<string[]> {
  const rows = await db
    .select({ email: masterUsers.email })
    .from(masterUsers)
    .innerJoin(userCashierPermissions, eq(userCashierPermissions.masterUserId, masterUsers.id))
    .where(
      and(
        eq(userCashierPermissions.cashierId, cashierId),
        eq(masterUsers.role, "master_clerk"),
        eq(masterUsers.isActive, true),
      ),
    );
  return rows.map((r) => r.email);
}

export async function getAdminEmailsForCashier(cashierId: string): Promise<string[]> {
  const rows = await db
    .select({ email: masterUsers.email })
    .from(masterUsers)
    .innerJoin(userCashierPermissions, eq(userCashierPermissions.masterUserId, masterUsers.id))
    .where(
      and(
        eq(userCashierPermissions.cashierId, cashierId),
        eq(masterUsers.role, "master_admin"),
        eq(masterUsers.isActive, true),
      ),
    );
  return rows.map((r) => r.email);
}

export async function setUserCashierPermissions(
  masterUserId: string,
  cashierIds: string[],
): Promise<void> {
  if (cashierIds.length > 0) {
    await db
      .insert(userCashierPermissions)
      .values(cashierIds.map((cashierId) => ({ masterUserId, cashierId })))
      .onConflictDoNothing();
  }

  // Remove any that were not included
  if (cashierIds.length > 0) {
    await db
      .delete(userCashierPermissions)
      .where(
        and(
          eq(userCashierPermissions.masterUserId, masterUserId),
          sql`${userCashierPermissions.cashierId} NOT IN ${sql`(${sql.join(cashierIds.map((id) => sql`${id}::uuid`), sql`, `)})`}`,
        ),
      );
  } else {
    await db
      .delete(userCashierPermissions)
      .where(eq(userCashierPermissions.masterUserId, masterUserId));
  }
}

export async function toggleUserCashierPermission(
  masterUserId: string,
  cashierId: string,
  assign: boolean,
): Promise<void> {
  if (assign) {
    await db
      .insert(userCashierPermissions)
      .values({ masterUserId, cashierId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(userCashierPermissions)
      .where(
        and(
          eq(userCashierPermissions.masterUserId, masterUserId),
          eq(userCashierPermissions.cashierId, cashierId),
        ),
      );
  }
}
