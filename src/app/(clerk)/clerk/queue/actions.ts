"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  transactions,
  transactionUpdates,
  notifications,
  auditLogs,
  cashierUsers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getClerkById } from "@/data/queue";
import { getCashierId } from "@/lib/cashier-context";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { releasePoolLocks } from "@/data/names-pool";

type ActionResult = { success: true } | { success: false; error: string };

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; lockedAt: Date | null } };

async function requireClerk(cashierId: string) {
  const session = await getUserSession();
  if (!session || session.role !== "clerk" || session.cashierId !== cashierId) return null;
  const clerk = await getClerkById(session.userId, cashierId);
  return clerk;
}

async function isMasterActingAsClerk(cashierId: string): Promise<boolean> {
  const masterSession = await getMasterSession();
  return !!(masterSession && masterSession.actingCashierId === cashierId && masterSession.actingRole === "clerk");
}

// ─── Lock ─────────────────────────────────────────────────────────────────────

export async function lockTransactionAction(transactionId: string): Promise<LockResult> {
  const cashierId = await getCashierId();
  const clerk = await requireClerk(cashierId);
  if (!clerk) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, lockedAt: null } };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId, lockExpiresAt: transactions.lockExpiresAt, status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, lockedAt: null } };

  const now = new Date();
  const lockExpired = tx.lockExpiresAt ? tx.lockExpiresAt < now : true;
  const isFree = !tx.lockedByClerkId || lockExpired;
  const isOwnLock = tx.lockedByClerkId === clerk.id;

  if (isFree || isOwnLock) {
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);
    await db
      .update(transactions)
      .set({
        lockedByClerkId: clerk.id,
        lockedAt: now,
        lockExpiresAt: expiresAt,
        ...(tx.status === "pending" ? { status: "in_progress" } : {}),
        updatedAt: now,
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

    if (isFree && !isOwnLock) {
      await db.insert(auditLogs).values({
        cashierId,
        actorUserId: clerk.id,
        action: "transaction.locked",
        entityType: "transaction",
        entityId: transactionId,
        metadata: { clerkId: clerk.id, clerkName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") },
      });
    }

    return { acquired: true, lockedByClerkId: clerk.id };
  }

  const [lockHolder] = await db
    .select({ id: cashierUsers.id, firstName: cashierUsers.firstName, lastName: cashierUsers.lastName })
    .from(cashierUsers)
    .where(eq(cashierUsers.id, tx.lockedByClerkId!))
    .limit(1);

  const [txFull] = await db
    .select({ lockedAt: transactions.lockedAt })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  return {
    acquired: false,
    lockedBy: {
      id: lockHolder?.id ?? "",
      firstName: lockHolder?.firstName ?? null,
      lastName: lockHolder?.lastName ?? null,
      lockedAt: txFull?.lockedAt ?? null,
    },
  };
}

// ─── Take Over ────────────────────────────────────────────────────────────────

export async function takeOverTransactionAction(transactionId: string): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const clerk = await requireClerk(cashierId);
  if (!clerk) return { success: false, error: "Unauthorized" };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000);

  await db
    .update(transactions)
    .set({
      lockedByClerkId: clerk.id,
      lockedAt: now,
      lockExpiresAt: expiresAt,
      status: "in_progress",
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: clerk.id,
    action: "transaction.taken_over",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousClerkId: tx?.lockedByClerkId ?? null,
      newClerkId: clerk.id,
      newClerkName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" "),
    },
  });

  revalidatePath("/clerk/queue");
  return { success: true };
}

// ─── Renew Lock ───────────────────────────────────────────────────────────────

export async function renewLockAction(transactionId: string): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const clerk = await requireClerk(cashierId);
  if (!clerk) return { success: false, error: "Unauthorized" };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (tx?.lockedByClerkId !== clerk.id) return { success: false, error: "You do not own this lock" };

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db
    .update(transactions)
    .set({ lockExpiresAt: expiresAt })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

  return { success: true };
}

// ─── Update Status ────────────────────────────────────────────────────────────

const updateSchema = z.object({
  transactionId: z.string().uuid(),
  newStatus: z.enum(["approved", "post_confirmed", "rejected", "completed"]),
  noteToPlayer: z.string().min(10, "Note to player must be at least 10 characters"),
  internalNote: z.string().optional(),
});

const TERMINAL_STATUSES = ["completed", "rejected", "cancelled"];

export async function updateTransactionStatusAction(
  input: unknown
): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const masterActing = await isMasterActingAsClerk(cashierId);
  const clerk = masterActing ? null : await requireClerk(cashierId);
  if (!masterActing && !clerk) return { success: false, error: "Unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote } = parsed.data;

  const [tx] = await db
    .select({
      lockedByClerkId: transactions.lockedByClerkId,
      status: transactions.status,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      amount: transactions.amount,
      currency: transactions.currency,
      playerId: transactions.playerId,
      methodId: transactions.methodId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };

  // Master bypasses lock ownership check
  if (!masterActing && tx.lockedByClerkId !== clerk!.id) {
    return { success: false, error: "You do not own the lock on this transaction." };
  }

  if (TERMINAL_STATUSES.includes(tx.status)) {
    return { success: false, error: "This transaction has already been finalized and cannot be updated." };
  }

  const previousStatus = tx.status;
  const now = new Date();

  await db
    .update(transactions)
    .set({
      status: newStatus,
      internalNote: internalNote ?? null,
      lockedByClerkId: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

  const [update] = await db
    .insert(transactionUpdates)
    .values({
      cashierId,
      transactionId,
      updatedByUserId: clerk?.id ?? null,
      previousStatus: previousStatus as "pending" | "in_progress" | "approved" | "rejected" | "completed" | "cancelled",
      newStatus,
      noteToPlayer,
      internalNote: internalNote ?? null,
      emailSentToPlayer: false,
    })
    .returning({ id: transactionUpdates.id });

  const [player] = await db
    .select({ id: cashierUsers.id, email: cashierUsers.email, firstName: cashierUsers.firstName })
    .from(cashierUsers)
    .where(eq(cashierUsers.id, tx.playerId))
    .limit(1);

  await db.insert(notifications).values({
    cashierId,
    userId: player.id,
    transactionId,
    transactionUpdateId: update.id,
    channel: "in_app",
    title: `Transaction ${tx.referenceCode} Updated`,
    body: noteToPlayer,
  });

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: clerk?.id ?? null,
    actorRole: "clerk",
    action: "transaction.status_updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousStatus,
      newStatus,
      clerkId: clerk?.id ?? null,
      clerkName: clerk ? [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") : "master",
      isMasterActing: masterActing,
    },
  });

  if (TERMINAL_STATUSES.includes(newStatus)) {
    await releasePoolLocks(transactionId);
  }

  revalidatePath("/clerk/queue");
  return { success: true };
}
