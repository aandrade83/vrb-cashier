// =============================================================================
// Names & Addresses pool — shared data layer for the two anonymization pools.
// Both tables are structurally identical so one file handles both.
// =============================================================================

import { db } from "@/db";
import { names, addresses, transactions } from "@/db/schema";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import type { Name, Address } from "@/db/schema";

// ─── Shared enriched row type ──────────────────────────────────────────────────

export type PoolRow = {
  id: string;
  cashierId: string;
  value: string;
  priority: number;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedByTransactionId: string | null;
  lockedByReferenceCode: string | null; // joined from transactions
  createdAt: Date;
};

// ─── READ ─────────────────────────────────────────────────────────────────────

export async function getAllNamesForCashier(cashierId: string): Promise<PoolRow[]> {
  const rows = await db
    .select({
      id: names.id,
      cashierId: names.cashierId,
      value: names.value,
      priority: names.priority,
      isActive: names.isActive,
      isLocked: names.isLocked,
      lockedAt: names.lockedAt,
      lockedByTransactionId: names.lockedByTransactionId,
      lockedByReferenceCode: transactions.referenceCode,
      createdAt: names.createdAt,
    })
    .from(names)
    .leftJoin(transactions, eq(names.lockedByTransactionId, transactions.id))
    .where(eq(names.cashierId, cashierId))
    .orderBy(asc(names.priority), asc(names.createdAt));
  return rows;
}

export async function getAllAddressesForCashier(cashierId: string): Promise<PoolRow[]> {
  const rows = await db
    .select({
      id: addresses.id,
      cashierId: addresses.cashierId,
      value: addresses.value,
      priority: addresses.priority,
      isActive: addresses.isActive,
      isLocked: addresses.isLocked,
      lockedAt: addresses.lockedAt,
      lockedByTransactionId: addresses.lockedByTransactionId,
      lockedByReferenceCode: transactions.referenceCode,
      createdAt: addresses.createdAt,
    })
    .from(addresses)
    .leftJoin(transactions, eq(addresses.lockedByTransactionId, transactions.id))
    .where(eq(addresses.cashierId, cashierId))
    .orderBy(asc(addresses.priority), asc(addresses.createdAt));
  return rows;
}

// ─── GET NEXT PRIORITY ────────────────────────────────────────────────────────

async function getNextPriority(table: "names" | "addresses", cashierId: string): Promise<number> {
  const tbl = table === "names" ? names : addresses;
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${tbl.priority}), 0)` })
    .from(tbl)
    .where(eq(tbl.cashierId, cashierId));
  return (row?.max ?? 0) + 1;
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

export async function createName(
  cashierId: string,
  value: string,
  priority?: number,
): Promise<string> {
  const p = priority ?? (await getNextPriority("names", cashierId));
  const [row] = await db
    .insert(names)
    .values({ cashierId, value: value.trim(), priority: p })
    .returning({ id: names.id });
  return row.id;
}

export async function createNamesBulk(cashierId: string, values: string[]): Promise<void> {
  if (values.length === 0) return;
  const startPriority = await getNextPriority("names", cashierId);
  await db.insert(names).values(
    values.map((v, i) => ({ cashierId, value: v.trim(), priority: startPriority + i })),
  );
}

export async function createAddress(
  cashierId: string,
  value: string,
  priority?: number,
): Promise<string> {
  const p = priority ?? (await getNextPriority("addresses", cashierId));
  const [row] = await db
    .insert(addresses)
    .values({ cashierId, value: value.trim(), priority: p })
    .returning({ id: addresses.id });
  return row.id;
}

export async function createAddressesBulk(cashierId: string, values: string[]): Promise<void> {
  if (values.length === 0) return;
  const startPriority = await getNextPriority("addresses", cashierId);
  await db.insert(addresses).values(
    values.map((v, i) => ({ cashierId, value: v.trim(), priority: startPriority + i })),
  );
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

export async function toggleNameActive(id: string): Promise<void> {
  const [row] = await db
    .select({ isActive: names.isActive })
    .from(names)
    .where(eq(names.id, id))
    .limit(1);
  if (!row) return;
  await db.update(names).set({ isActive: !row.isActive }).where(eq(names.id, id));
}

export async function updateNamePriority(id: string, priority: number): Promise<void> {
  await db.update(names).set({ priority }).where(eq(names.id, id));
}

export async function toggleAddressActive(id: string): Promise<void> {
  const [row] = await db
    .select({ isActive: addresses.isActive })
    .from(addresses)
    .where(eq(addresses.id, id))
    .limit(1);
  if (!row) return;
  await db.update(addresses).set({ isActive: !row.isActive }).where(eq(addresses.id, id));
}

export async function updateAddressPriority(id: string, priority: number): Promise<void> {
  await db.update(addresses).set({ priority }).where(eq(addresses.id, id));
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function deleteName(id: string): Promise<{ success: boolean; error?: string }> {
  const [row] = await db
    .select({ isLocked: names.isLocked })
    .from(names)
    .where(eq(names.id, id))
    .limit(1);
  if (!row) return { success: false, error: "Not found." };
  if (row.isLocked) return { success: false, error: "Cannot delete a name that is currently assigned to a transaction." };
  await db.delete(names).where(eq(names.id, id));
  return { success: true };
}

export async function deleteAddress(id: string): Promise<{ success: boolean; error?: string }> {
  const [row] = await db
    .select({ isLocked: addresses.isLocked })
    .from(addresses)
    .where(eq(addresses.id, id))
    .limit(1);
  if (!row) return { success: false, error: "Not found." };
  if (row.isLocked) return { success: false, error: "Cannot delete an address that is currently assigned to a transaction." };
  await db.delete(addresses).where(eq(addresses.id, id));
  return { success: true };
}

// ─── AUTO-ASSIGNMENT (called at transaction creation) ─────────────────────────
// Uses a CTE with FOR UPDATE SKIP LOCKED for safe concurrent assignment.

export async function assignName(
  cashierId: string,
  transactionId: string,
): Promise<string | null> {
  const result = await db.execute(sql`
    WITH target AS (
      SELECT id FROM names
      WHERE cashier_id = ${cashierId}::uuid
        AND is_active = true
        AND is_locked = false
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE names SET
      is_locked = true,
      locked_at = now(),
      locked_by_transaction_id = ${transactionId}::uuid
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);
  const rows = result.rows as { value: string }[];
  return rows[0]?.value ?? null;
}

export async function assignAddress(
  cashierId: string,
  transactionId: string,
): Promise<string | null> {
  const result = await db.execute(sql`
    WITH target AS (
      SELECT id FROM addresses
      WHERE cashier_id = ${cashierId}::uuid
        AND is_active = true
        AND is_locked = false
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE addresses SET
      is_locked = true,
      locked_at = now(),
      locked_by_transaction_id = ${transactionId}::uuid
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);
  const rows = result.rows as { value: string }[];
  return rows[0]?.value ?? null;
}

// ─── RELEASE LOCKS (called when transaction reaches a terminal state) ─────────

export async function releasePoolLocks(transactionId: string): Promise<void> {
  await Promise.all([
    db
      .update(names)
      .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
      .where(eq(names.lockedByTransactionId, transactionId)),
    db
      .update(addresses)
      .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
      .where(eq(addresses.lockedByTransactionId, transactionId)),
  ]);
}
