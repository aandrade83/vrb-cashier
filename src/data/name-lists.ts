// =============================================================================
// Name Lists — data layer
// Method-scoped, multi-cashier-shared name pools with blocking modes.
// =============================================================================

import { db } from "@/db";
import {
  nameLists,
  nameListCashiers,
  nameListNames,
  cashiers,
  paymentMethods,
  transactions,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NameListRow = {
  id: string;
  methodId: string;
  blockingMode: "yes" | "no";
  createdAt: Date;
  cashiers: { id: string; name: string; slug: string }[];
  nameCount: number;
};

export type LockedNameRow = {
  id: string;
  value: string;
  methodId: string;
  methodName: string;
  nameListId: string;
  lockedByTransactionId: string;
  transactionReferenceCode: string;
  transactionCreatedAt: Date;
};

export type MethodWithListsAndNames = {
  id: string;
  name: string;
  type: string;
  lists: (NameListRow & { names: NameListNameRow[] })[];
};

export type NameListNameRow = {
  id: string;
  nameListId: string;
  value: string;
  valueNormalized: string;
  priority: number;
  isActive: boolean;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedByTransactionId: string | null;
  lastUsedAt: Date | null;
  lastUsedReference: string | null;
  createdAt: Date;
  // from joined transaction (null when name is not locked)
  transactionReferenceCode: string | null;
  transactionCreatedAt: Date | null;
  // computed
  status: "available" | "locked" | "inactive";
};

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export async function getNameListsForMethod(methodId: string): Promise<NameListRow[]> {
  const lists = await db
    .select({ id: nameLists.id, methodId: nameLists.methodId, blockingMode: nameLists.blockingMode, createdAt: nameLists.createdAt })
    .from(nameLists)
    .where(eq(nameLists.methodId, methodId))
    .orderBy(nameLists.createdAt);

  if (lists.length === 0) return [];

  const listIds = lists.map((l) => l.id);

  const junctions = await db
    .select({
      nameListId: nameListCashiers.nameListId,
      cashierId: cashiers.id,
      cashierName: cashiers.name,
      cashierSlug: cashiers.slug,
    })
    .from(nameListCashiers)
    .innerJoin(cashiers, eq(nameListCashiers.cashierId, cashiers.id))
    .where(inArray(nameListCashiers.nameListId, listIds));

  const counts = await db
    .select({ nameListId: nameListNames.nameListId, count: sql<number>`COUNT(*)::int` })
    .from(nameListNames)
    .where(inArray(nameListNames.nameListId, listIds))
    .groupBy(nameListNames.nameListId);

  const countMap = Object.fromEntries(counts.map((c) => [c.nameListId, c.count]));

  return lists.map((list) => ({
    ...list,
    cashiers: junctions
      .filter((j) => j.nameListId === list.id)
      .map((j) => ({ id: j.cashierId, name: j.cashierName, slug: j.cashierSlug })),
    nameCount: countMap[list.id] ?? 0,
  }));
}

export async function getNameListForCashier(
  methodId: string,
  cashierId: string,
): Promise<{ id: string; blockingMode: "yes" | "no" } | null> {
  const [row] = await db
    .select({ id: nameLists.id, blockingMode: nameLists.blockingMode })
    .from(nameLists)
    .innerJoin(nameListCashiers, eq(nameListCashiers.nameListId, nameLists.id))
    .where(and(eq(nameListCashiers.methodId, methodId), eq(nameListCashiers.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}

export async function getAvailableCashiersForMethod(
  methodId: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const assigned = await db
    .select({ cashierId: nameListCashiers.cashierId })
    .from(nameListCashiers)
    .where(eq(nameListCashiers.methodId, methodId));

  const assignedIds = assigned.map((a) => a.cashierId);

  const query = db
    .select({ id: cashiers.id, name: cashiers.name, slug: cashiers.slug })
    .from(cashiers)
    .where(eq(cashiers.isActive, true))
    .orderBy(cashiers.createdAt);

  const all = await query;
  return all.filter((c) => !assignedIds.includes(c.id));
}

export async function getNamesForList(nameListId: string): Promise<NameListNameRow[]> {
  const rows = await db
    .select({
      id: nameListNames.id,
      nameListId: nameListNames.nameListId,
      value: nameListNames.value,
      valueNormalized: nameListNames.valueNormalized,
      priority: nameListNames.priority,
      isActive: nameListNames.isActive,
      isLocked: nameListNames.isLocked,
      lockedAt: nameListNames.lockedAt,
      lockedByTransactionId: nameListNames.lockedByTransactionId,
      lastUsedAt: nameListNames.lastUsedAt,
      lastUsedReference: nameListNames.lastUsedReference,
      createdAt: nameListNames.createdAt,
      updatedAt: nameListNames.updatedAt,
      transactionReferenceCode: transactions.referenceCode,
      transactionCreatedAt: transactions.createdAt,
    })
    .from(nameListNames)
    .leftJoin(transactions, eq(nameListNames.lockedByTransactionId, transactions.id))
    .where(eq(nameListNames.nameListId, nameListId))
    .orderBy(nameListNames.priority, nameListNames.createdAt);

  return rows.map((r) => ({
    ...r,
    status: !r.isActive ? "inactive" : r.isLocked ? "locked" : "available",
  }));
}

export async function getLockedNameForTransaction(
  transactionId: string,
): Promise<{ id: string; value: string; nameListId: string } | null> {
  const [row] = await db
    .select({ id: nameListNames.id, value: nameListNames.value, nameListId: nameListNames.nameListId })
    .from(nameListNames)
    .where(eq(nameListNames.lockedByTransactionId, transactionId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createNameList(
  methodId: string,
  cashierIds: string[],
  blockingMode: "yes" | "no",
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  if (cashierIds.length === 0) {
    return { success: false, error: "At least one cashier is required." };
  }

  // Verify no cashier is already in a list for this method
  if (cashierIds.length > 0) {
    const existing = await db
      .select({ cashierId: nameListCashiers.cashierId })
      .from(nameListCashiers)
      .where(
        and(
          eq(nameListCashiers.methodId, methodId),
          inArray(nameListCashiers.cashierId, cashierIds),
        ),
      );
    if (existing.length > 0) {
      return { success: false, error: "One or more cashiers are already assigned to a list for this method." };
    }
  }

  const [list] = await db
    .insert(nameLists)
    .values({ methodId, blockingMode })
    .returning({ id: nameLists.id });

  await db.insert(nameListCashiers).values(
    cashierIds.map((cashierId) => ({
      nameListId: list.id,
      cashierId,
      methodId,
    })),
  );

  return { success: true, id: list.id };
}

export async function addNamesToList(
  nameListId: string,
  entries: { value: string; priority: number }[],
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;

  for (const entry of entries) {
    const normalized = entry.value.trim().toLowerCase();
    if (!normalized) { skipped++; continue; }

    try {
      await db.insert(nameListNames).values({
        nameListId,
        value: entry.value.trim(),
        valueNormalized: normalized,
        priority: entry.priority,
      });
      added++;
    } catch {
      // UNIQUE constraint violation = duplicate
      skipped++;
    }
  }

  return { added, skipped };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateNameInList(
  id: string,
  data: { value?: string; priority?: number; isActive?: boolean },
): Promise<{ success: true } | { success: false; error: string }> {
  const updates: Partial<typeof nameListNames.$inferInsert> = {};

  if (data.value !== undefined) {
    const normalized = data.value.trim().toLowerCase();
    if (!normalized) return { success: false, error: "Name cannot be empty." };
    updates.value = data.value.trim();
    updates.valueNormalized = normalized;
  }
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  updates.updatedAt = new Date();

  try {
    await db.update(nameListNames).set(updates).where(eq(nameListNames.id, id));
    return { success: true };
  } catch {
    return { success: false, error: "A name with this value already exists in this list." };
  }
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteNameFromList(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const [row] = await db
    .select({ isLocked: nameListNames.isLocked })
    .from(nameListNames)
    .where(eq(nameListNames.id, id))
    .limit(1);

  if (!row) return { success: false, error: "Name not found." };
  if (row.isLocked) return { success: false, error: "Cannot delete a name that is currently locked by an active transaction." };

  await db.delete(nameListNames).where(eq(nameListNames.id, id));
  return { success: true };
}

export async function removeCashierFromList(
  nameListId: string,
  cashierId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  // Check for active locks on names in this list that are tied to the cashier's transactions
  const activeLocks = await db
    .select({ id: nameListNames.id })
    .from(nameListNames)
    .where(
      and(
        eq(nameListNames.nameListId, nameListId),
        eq(nameListNames.isLocked, true),
      ),
    )
    .limit(1);

  if (activeLocks.length > 0) {
    return { success: false, error: "Cannot remove cashier while active name locks exist in this list." };
  }

  await db
    .delete(nameListCashiers)
    .where(
      and(
        eq(nameListCashiers.nameListId, nameListId),
        eq(nameListCashiers.cashierId, cashierId),
      ),
    );

  return { success: true };
}

export async function deleteNameList(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const activeLocks = await db
    .select({ id: nameListNames.id })
    .from(nameListNames)
    .where(and(eq(nameListNames.nameListId, id), eq(nameListNames.isLocked, true)))
    .limit(1);

  if (activeLocks.length > 0) {
    return { success: false, error: "Cannot delete a list with active name locks." };
  }

  await db.delete(nameLists).where(eq(nameLists.id, id));
  return { success: true };
}

// ---------------------------------------------------------------------------
// Name assignment — concurrency-safe
// ---------------------------------------------------------------------------

// Read-only peek: returns next available name without writing anything.
// Called on button click — no rotation committed until submit.
export async function peekNextName(
  methodId: string,
  cashierId: string,
): Promise<{ id: string; value: string; blockingMode: "yes" | "no" } | null> {
  const list = await getNameListForCashier(methodId, cashierId);
  if (!list) return null;

  const rows = await db
    .select({ id: nameListNames.id, value: nameListNames.value })
    .from(nameListNames)
    .where(
      and(
        eq(nameListNames.nameListId, list.id),
        eq(nameListNames.isActive, true),
        ...(list.blockingMode === "yes" ? [eq(nameListNames.isLocked, false)] : []),
      ),
    )
    .orderBy(
      nameListNames.priority,
      // For rotation mode, prefer least-recently-used
      ...(list.blockingMode === "no" ? [sql`COALESCE(${nameListNames.lastUsedAt}, '-infinity'::timestamptz) ASC`] : []),
      nameListNames.createdAt,
    )
    .limit(1);

  if (!rows[0]) return null;
  return { ...rows[0], blockingMode: list.blockingMode };
}

// Lock a specific name for a transaction (blocking mode YES, called on submit).
// Uses FOR UPDATE SKIP LOCKED to be race-safe.
export async function lockNameForTransaction(
  nameListNameId: string,
  transactionId: string,
  referenceCode: string,
): Promise<{ value: string } | null> {
  const now = new Date();
  const result = await db.execute(sql`
    WITH target AS (
      SELECT id FROM ${nameListNames}
      WHERE id = ${nameListNameId}
        AND is_active = true
        AND is_locked = false
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${nameListNames}
    SET is_locked = true,
        locked_at = ${now},
        locked_by_transaction_id = ${transactionId},
        last_used_at = ${now},
        last_used_reference = ${referenceCode},
        updated_at = ${now}
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);

  const row = (result.rows as Array<{ value: string }>)[0];
  return row ?? null;
}

// Lock next available name in the list (fallback when specific name is taken).
export async function lockNextAvailableForTransaction(
  methodId: string,
  cashierId: string,
  transactionId: string,
  referenceCode: string,
): Promise<{ value: string } | null> {
  const list = await getNameListForCashier(methodId, cashierId);
  if (!list || list.blockingMode !== "yes") return null;

  const now = new Date();
  const result = await db.execute(sql`
    WITH target AS (
      SELECT id FROM ${nameListNames}
      WHERE name_list_id = ${list.id}
        AND is_active = true
        AND is_locked = false
      ORDER BY priority ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${nameListNames}
    SET is_locked = true,
        locked_at = ${now},
        locked_by_transaction_id = ${transactionId},
        last_used_at = ${now},
        last_used_reference = ${referenceCode},
        updated_at = ${now}
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);

  const row = (result.rows as Array<{ value: string }>)[0];
  return row ?? null;
}

// Commit rotation for blocking mode NO (called on submit, not click).
export async function commitRotation(
  methodId: string,
  cashierId: string,
  nameListNameId: string,
  referenceCode: string,
): Promise<{ value: string } | null> {
  const list = await getNameListForCashier(methodId, cashierId);
  if (!list || list.blockingMode !== "no") return null;

  const now = new Date();
  const result = await db.execute(sql`
    WITH target AS (
      SELECT id FROM ${nameListNames}
      WHERE id = ${nameListNameId}
        AND is_active = true
        AND name_list_id = ${list.id}
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${nameListNames}
    SET last_used_at = ${now},
        last_used_reference = ${referenceCode},
        updated_at = ${now}
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);

  const row = (result.rows as Array<{ value: string }>)[0];
  if (row) return row;

  // Specific name no longer active — fall back to next in rotation
  const fallback = await db.execute(sql`
    WITH target AS (
      SELECT id FROM ${nameListNames}
      WHERE name_list_id = ${list.id}
        AND is_active = true
      ORDER BY priority ASC, COALESCE(last_used_at, '-infinity'::timestamptz) ASC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE ${nameListNames}
    SET last_used_at = ${now},
        last_used_reference = ${referenceCode},
        updated_at = ${now}
    WHERE id = (SELECT id FROM target)
    RETURNING value
  `);

  return (fallback.rows as Array<{ value: string }>)[0] ?? null;
}

// Release the name lock held by a transaction.
// Idempotent — safe to call multiple times.
export async function releaseNameForTransaction(transactionId: string): Promise<void> {
  await db
    .update(nameListNames)
    .set({
      isLocked: false,
      lockedAt: null,
      lockedByTransactionId: null,
      updatedAt: new Date(),
    })
    .where(eq(nameListNames.lockedByTransactionId, transactionId));
}

// ---------------------------------------------------------------------------
// Helpers for method dropdown in admin UI
// ---------------------------------------------------------------------------

export async function getAllActiveMethodsForNameLists(): Promise<
  { id: string; name: string; type: string }[]
> {
  return db
    .select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.isActive, true), eq(paymentMethods.isDeleted, false)))
    .orderBy(paymentMethods.name);
}

export async function hasNameListForMethod(methodId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: nameLists.id })
    .from(nameLists)
    .where(eq(nameLists.methodId, methodId))
    .limit(1);
  return !!row;
}

export async function getAllLockedNames(): Promise<LockedNameRow[]> {
  const rows = await db
    .select({
      id: nameListNames.id,
      value: nameListNames.value,
      nameListId: nameListNames.nameListId,
      lockedByTransactionId: nameListNames.lockedByTransactionId,
      methodId: nameLists.methodId,
      methodName: paymentMethods.name,
      transactionReferenceCode: transactions.referenceCode,
      transactionCreatedAt: transactions.createdAt,
    })
    .from(nameListNames)
    .innerJoin(nameLists, eq(nameListNames.nameListId, nameLists.id))
    .innerJoin(paymentMethods, eq(nameLists.methodId, paymentMethods.id))
    .innerJoin(transactions, eq(nameListNames.lockedByTransactionId, transactions.id))
    .where(eq(nameListNames.isLocked, true))
    .orderBy(nameListNames.lockedAt);

  return rows.map((r) => ({
    id: r.id,
    value: r.value,
    nameListId: r.nameListId,
    lockedByTransactionId: r.lockedByTransactionId!,
    methodId: r.methodId,
    methodName: r.methodName,
    transactionReferenceCode: r.transactionReferenceCode,
    transactionCreatedAt: r.transactionCreatedAt!,
  }));
}

export async function getMethodsWithAvailableSlots(): Promise<
  { id: string; name: string; type: string; availableCashiers: { id: string; name: string; slug: string }[] }[]
> {
  const [allCashierRows, allMethods, assigned] = await Promise.all([
    db.select({ id: cashiers.id, name: cashiers.name, slug: cashiers.slug })
      .from(cashiers)
      .where(eq(cashiers.isActive, true))
      .orderBy(cashiers.createdAt),
    db.select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.isActive, true), eq(paymentMethods.isDeleted, false)))
      .orderBy(paymentMethods.name),
    db.select({ methodId: nameListCashiers.methodId, cashierId: nameListCashiers.cashierId })
      .from(nameListCashiers),
  ]);

  if (allCashierRows.length === 0 || allMethods.length === 0) return [];

  const assignedByMethod: Record<string, Set<string>> = {};
  for (const a of assigned) {
    if (!assignedByMethod[a.methodId]) assignedByMethod[a.methodId] = new Set();
    assignedByMethod[a.methodId].add(a.cashierId);
  }

  return allMethods
    .map((m) => {
      const assignedIds = assignedByMethod[m.id] ?? new Set<string>();
      const availableCashiers = allCashierRows.filter((c) => !assignedIds.has(c.id));
      return { ...m, availableCashiers };
    })
    .filter((m) => m.availableCashiers.length > 0);
}

export async function getAllMethodsWithListsAndNames(): Promise<MethodWithListsAndNames[]> {
  const allLists = await db
    .select({ id: nameLists.id, methodId: nameLists.methodId, blockingMode: nameLists.blockingMode, createdAt: nameLists.createdAt })
    .from(nameLists)
    .orderBy(nameLists.createdAt);

  if (allLists.length === 0) return [];

  const allMethodIds = [...new Set(allLists.map((l) => l.methodId))];
  const allListIds = allLists.map((l) => l.id);

  const [methods, junctions, counts, allNameRows] = await Promise.all([
    db.select({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
      .from(paymentMethods)
      .where(inArray(paymentMethods.id, allMethodIds))
      .orderBy(paymentMethods.name),
    db.select({
        nameListId: nameListCashiers.nameListId,
        cashierId: cashiers.id,
        cashierName: cashiers.name,
        cashierSlug: cashiers.slug,
      })
      .from(nameListCashiers)
      .innerJoin(cashiers, eq(nameListCashiers.cashierId, cashiers.id))
      .where(inArray(nameListCashiers.nameListId, allListIds)),
    db.select({ nameListId: nameListNames.nameListId, count: sql<number>`COUNT(*)::int` })
      .from(nameListNames)
      .where(inArray(nameListNames.nameListId, allListIds))
      .groupBy(nameListNames.nameListId),
    db.select({
        id: nameListNames.id,
        nameListId: nameListNames.nameListId,
        value: nameListNames.value,
        valueNormalized: nameListNames.valueNormalized,
        priority: nameListNames.priority,
        isActive: nameListNames.isActive,
        isLocked: nameListNames.isLocked,
        lockedAt: nameListNames.lockedAt,
        lockedByTransactionId: nameListNames.lockedByTransactionId,
        lastUsedAt: nameListNames.lastUsedAt,
        lastUsedReference: nameListNames.lastUsedReference,
        createdAt: nameListNames.createdAt,
        updatedAt: nameListNames.updatedAt,
        transactionReferenceCode: transactions.referenceCode,
        transactionCreatedAt: transactions.createdAt,
      })
      .from(nameListNames)
      .leftJoin(transactions, eq(nameListNames.lockedByTransactionId, transactions.id))
      .where(inArray(nameListNames.nameListId, allListIds))
      .orderBy(nameListNames.nameListId, nameListNames.priority, nameListNames.createdAt),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.nameListId, c.count]));

  const namesByList: Record<string, NameListNameRow[]> = {};
  for (const n of allNameRows) {
    const status: "available" | "locked" | "inactive" = !n.isActive ? "inactive" : n.isLocked ? "locked" : "available";
    if (!namesByList[n.nameListId]) namesByList[n.nameListId] = [];
    namesByList[n.nameListId].push({ ...n, status });
  }

  const listsById = new Map(
    allLists.map((l) => [
      l.id,
      {
        ...l,
        cashiers: junctions.filter((j) => j.nameListId === l.id).map((j) => ({ id: j.cashierId, name: j.cashierName, slug: j.cashierSlug })),
        nameCount: countMap[l.id] ?? 0,
        names: namesByList[l.id] ?? [],
      },
    ]),
  );

  return methods.map((m) => ({
    ...m,
    lists: allLists.filter((l) => l.methodId === m.id).map((l) => listsById.get(l.id)!),
  }));
}
