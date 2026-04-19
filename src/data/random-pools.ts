// =============================================================================
// Pools — data helpers for names and addresses tables.
// Scoped per cashier. Used by Admin to manage pools and by the player form
// to acquire/release locks.
// =============================================================================

import { db } from "@/db";
import { names, addresses } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import type { Name, Address } from "@/db/schema";

// ─────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────

export async function getNames(cashierId: string): Promise<Name[]> {
  return db
    .select()
    .from(names)
    .where(eq(names.cashierId, cashierId))
    .orderBy(asc(names.priority), asc(names.createdAt));
}

export async function getAddresses(cashierId: string): Promise<Address[]> {
  return db
    .select()
    .from(addresses)
    .where(eq(addresses.cashierId, cashierId))
    .orderBy(asc(addresses.priority), asc(addresses.createdAt));
}

// ─────────────────────────────────────────────
// ADMIN MUTATIONS — Names
// ─────────────────────────────────────────────

export async function createName(
  cashierId: string,
  value: string,
  priority: number
): Promise<Name> {
  const [row] = await db
    .insert(names)
    .values({ cashierId, value, priority, isActive: true })
    .returning();
  return row;
}

export async function updateName(
  id: string,
  cashierId: string,
  data: Partial<Pick<Name, "value" | "priority" | "isActive">>
): Promise<Name> {
  const [row] = await db
    .update(names)
    .set(data)
    .where(and(eq(names.id, id), eq(names.cashierId, cashierId)))
    .returning();
  return row;
}

export async function deleteName(id: string, cashierId: string): Promise<void> {
  await db
    .delete(names)
    .where(and(eq(names.id, id), eq(names.cashierId, cashierId)));
}

// ─────────────────────────────────────────────
// ADMIN MUTATIONS — Addresses
// ─────────────────────────────────────────────

export async function createAddress(
  cashierId: string,
  value: string,
  priority: number
): Promise<Address> {
  const [row] = await db
    .insert(addresses)
    .values({ cashierId, value, priority, isActive: true })
    .returning();
  return row;
}

export async function updateAddress(
  id: string,
  cashierId: string,
  data: Partial<Pick<Address, "value" | "priority" | "isActive">>
): Promise<Address> {
  const [row] = await db
    .update(addresses)
    .set(data)
    .where(and(eq(addresses.id, id), eq(addresses.cashierId, cashierId)))
    .returning();
  return row;
}

export async function deleteAddress(id: string, cashierId: string): Promise<void> {
  await db
    .delete(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.cashierId, cashierId)));
}

// ─────────────────────────────────────────────
// LOCK SYSTEM — used when player opens a method form
// ─────────────────────────────────────────────

/**
 * Acquires the lowest-priority available (active + unlocked) name
 * for a given cashier. Locks it to the transactionId.
 * Returns null if none available.
 */
export async function acquireName(
  cashierId: string,
  transactionId: string
): Promise<Name | null> {
  const [available] = await db
    .select()
    .from(names)
    .where(
      and(
        eq(names.cashierId, cashierId),
        eq(names.isActive, true),
        eq(names.isLocked, false)
      )
    )
    .orderBy(asc(names.priority), asc(names.createdAt))
    .limit(1);

  if (!available) return null;

  const [locked] = await db
    .update(names)
    .set({
      isLocked: true,
      lockedAt: new Date(),
      lockedByTransactionId: transactionId,
    })
    .where(
      and(
        eq(names.id, available.id),
        eq(names.isLocked, false) // guard against race
      )
    )
    .returning();

  return locked ?? null;
}

/**
 * Acquires the lowest-priority available address.
 * Returns null if none available.
 */
export async function acquireAddress(
  cashierId: string,
  transactionId: string
): Promise<Address | null> {
  const [available] = await db
    .select()
    .from(addresses)
    .where(
      and(
        eq(addresses.cashierId, cashierId),
        eq(addresses.isActive, true),
        eq(addresses.isLocked, false)
      )
    )
    .orderBy(asc(addresses.priority), asc(addresses.createdAt))
    .limit(1);

  if (!available) return null;

  const [locked] = await db
    .update(addresses)
    .set({
      isLocked: true,
      lockedAt: new Date(),
      lockedByTransactionId: transactionId,
    })
    .where(
      and(
        eq(addresses.id, available.id),
        eq(addresses.isLocked, false)
      )
    )
    .returning();

  return locked ?? null;
}

/**
 * Releases (unlocks) all names locked to a transactionId.
 * Called when: player abandons form, or transaction is completed/rejected.
 */
export async function releaseNameByTransaction(transactionId: string): Promise<void> {
  await db
    .update(names)
    .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
    .where(eq(names.lockedByTransactionId, transactionId));
}

/**
 * Releases (unlocks) all addresses locked to a transactionId.
 */
export async function releaseAddressByTransaction(transactionId: string): Promise<void> {
  await db
    .update(addresses)
    .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
    .where(eq(addresses.lockedByTransactionId, transactionId));
}

/**
 * Releases a specific name by its id (used when player abandons without a transactionId).
 */
export async function releaseNameById(id: string, cashierId: string): Promise<void> {
  await db
    .update(names)
    .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
    .where(and(eq(names.id, id), eq(names.cashierId, cashierId)));
}

/**
 * Releases a specific address by its id.
 */
export async function releaseAddressById(id: string, cashierId: string): Promise<void> {
  await db
    .update(addresses)
    .set({ isLocked: false, lockedAt: null, lockedByTransactionId: null })
    .where(and(eq(addresses.id, id), eq(addresses.cashierId, cashierId)));
}
