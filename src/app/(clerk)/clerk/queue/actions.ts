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
import { getOrCreateCashierActor, type CashierActor } from "@/lib/master-actor";
import { releasePoolLocks } from "@/data/names-pool";
import { TERMINAL_STATUSES } from "@/lib/transaction-statuses";

type ActionResult = { success: true } | { success: false; error: string };

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; username: string | null; lockedAt: Date | null } };

// ─── Unified actor resolution ──────────────────────────────────────────────────
//
// Returns a real cashierUsers row for both regular clerks (their own row) and
// master users (a shadow __m__<username> row auto-created on first access).
// Returns null if the session has no valid access to this cashier.

async function resolveActor(cashierId: string): Promise<CashierActor | null> {
  // Regular clerk session
  const userSession = await getUserSession();
  if (userSession && userSession.cashierId === cashierId && userSession.role === "clerk") {
    const clerk = await getClerkById(userSession.userId, cashierId);
    if (!clerk) return null;
    return {
      id: clerk.id,
      username: clerk.username,
      firstName: clerk.firstName,
      lastName: clerk.lastName,
      role: clerk.role,
      masterRole: null,
    };
  }

  // Master acting as clerk inside this cashier
  const masterSession = await getMasterSession();
  if (masterSession?.actingCashierId === cashierId && masterSession.actingRole === "clerk") {
    return getOrCreateCashierActor(cashierId);
  }

  return null;
}

// ─── Lock ─────────────────────────────────────────────────────────────────────
// Works for both regular clerks and master_clerk (via shadow identity).
// master_admin does NOT call this — the page handles their elevated lock state.

export async function lockTransactionAction(transactionId: string): Promise<LockResult> {
  const cashierId = await getCashierId();

  const actor = await resolveActor(cashierId);
  if (!actor) {
    return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };
  }

  const [tx] = await db
    .select({
      lockedByClerkId: transactions.lockedByClerkId,
      status: transactions.status,
      assignedAt: transactions.assignedAt,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };

  const isFree = !tx.lockedByClerkId;
  const isOwnLock = tx.lockedByClerkId === actor.id;

  if (isFree || isOwnLock) {
    const now = new Date();
    const isFirstAssignment = isFree && !isOwnLock && tx.status === "unassigned";

    const lockUpdated = await db
      .update(transactions)
      .set({
        lockedByClerkId: actor.id,
        lockedAt: now,
        lockExpiresAt: null,
        ...(isFirstAssignment ? { status: "pending", assignedAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
      .returning({ id: transactions.id });

    console.log("[lock] transactionId=%s cashierId=%s actorId=%s isFirstAssignment=%s rowsAffected=%d",
      transactionId, cashierId, actor.id, isFirstAssignment, lockUpdated.length);

    if (lockUpdated.length === 0) {
      return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };
    }

    if (isFirstAssignment) {
      await db.insert(auditLogs).values({
        cashierId,
        actorUserId: actor.id,
        actorRole: actor.masterRole ? null : "clerk",
        action: "transaction.assigned",
        entityType: "transaction",
        entityId: transactionId,
        metadata: {
          clerkId: actor.id,
          clerkName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.username,
          changed_by_username: actor.username,
          changed_by_role: actor.masterRole ?? actor.role,
        },
      });
    }

    return { acquired: true, lockedByClerkId: actor.id };
  }

  // Locked by someone else — return holder info
  const [lockHolder] = await db
    .select({ id: cashierUsers.id, firstName: cashierUsers.firstName, lastName: cashierUsers.lastName, username: cashierUsers.username })
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
      username: lockHolder?.username ?? null,
      lockedAt: txFull?.lockedAt ?? null,
    },
  };
}

// ─── Take Over ────────────────────────────────────────────────────────────────

export async function takeOverTransactionAction(transactionId: string): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const actor = await resolveActor(cashierId);

  console.log("[takeOver] transactionId=%s cashierId=%s actorId=%s isMasterActor=%s",
    transactionId, cashierId, actor?.id ?? "null", actor?.masterRole != null);

  if (!actor) return { success: false, error: "Unauthorized — no valid session for this cashier." };

  const now = new Date();

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId, status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found." };

  const wasUnassigned = tx.status === "unassigned";

  const updated = await db
    .update(transactions)
    .set({
      lockedByClerkId: actor.id,
      lockedAt: now,
      lockExpiresAt: null,
      ...(wasUnassigned ? { status: "pending", assignedAt: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .returning({ id: transactions.id });

  console.log("[takeOver] rowsAffected=%d lockedByClerkId=%s", updated.length, actor.id);

  if (updated.length === 0) {
    return { success: false, error: "Transaction not found or cashier mismatch — no rows updated." };
  }

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: actor.id,
    actorRole: actor.masterRole ? null : "clerk",
    action: "transaction.taken_over",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousAssignedUserId: tx.lockedByClerkId ?? null,
      newAssignedUserId: actor.id,
      newAssignedUserName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.username,
      isMasterActor: actor.masterRole != null,
      masterRole: actor.masterRole,
      changed_by_username: actor.username,
      changed_by_role: actor.masterRole ?? actor.role,
      takenOverAt: now.toISOString(),
    },
  });

  revalidatePath("/clerk/queue");
  revalidatePath(`/clerk/queue/${transactionId}`);
  return { success: true };
}

// ─── Update Status ────────────────────────────────────────────────────────────

const updateSchema = z
  .object({
    transactionId: z.string().uuid(),
    newStatus: z.enum(["preconfirmed", "postconfirmed", "denied", "completed"]),
    noteToPlayer: z.string().optional().default(""),
    internalNote: z.string().optional(),
    deniedReason: z.string().min(3, "Denial reason is required").optional(),
  })
  .refine(
    (d) => d.newStatus !== "denied" || (!!d.deniedReason && d.deniedReason.trim().length >= 3),
    { message: "Denial reason is required when denying a transaction", path: ["deniedReason"] },
  );

export async function updateTransactionStatusAction(input: unknown): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const actor = await resolveActor(cashierId);

  if (!actor) return { success: false, error: "Unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote, deniedReason } = parsed.data;

  // Only master_admin can complete a postconfirmed transaction
  if (newStatus === "completed" && actor.masterRole !== "master_admin") {
    return { success: false, error: "Only master admins can complete post-confirmed transactions." };
  }

  const [tx] = await db
    .select({
      lockedByClerkId: transactions.lockedByClerkId,
      status: transactions.status,
      referenceCode: transactions.referenceCode,
      playerId: transactions.playerId,
    })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };

  if (TERMINAL_STATUSES.includes(tx.status as never)) {
    return { success: false, error: "This transaction has already been finalized." };
  }

  // master_admin can act on any transaction regardless of lock owner
  const bypassLockCheck = actor.masterRole === "master_admin";
  if (!bypassLockCheck && tx.lockedByClerkId !== actor.id) {
    return { success: false, error: "You do not own the lock on this transaction." };
  }

  const previousStatus = tx.status;
  const now = new Date();

  const statusTimestamps = {
    ...(newStatus === "preconfirmed"  ? { preconfirmedAt: now  } : {}),
    ...(newStatus === "postconfirmed" ? { postconfirmedAt: now } : {}),
    ...(newStatus === "completed"     ? { completedAt: now     } : {}),
    ...(newStatus === "denied"        ? { deniedAt: now        } : {}),
  };

  const isTerminal = TERMINAL_STATUSES.includes(newStatus as never);

  await db
    .update(transactions)
    .set({
      status: newStatus,
      internalNote: internalNote ?? null,
      ...(newStatus === "denied" ? { deniedReason: deniedReason ?? null } : {}),
      ...statusTimestamps,
      ...(isTerminal ? { lockedByClerkId: null, lockedAt: null, lockExpiresAt: null } : {}),
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

  const [update] = await db
    .insert(transactionUpdates)
    .values({
      cashierId,
      transactionId,
      updatedByUserId: actor.id,
      previousStatus: previousStatus as "unassigned" | "pending" | "preconfirmed" | "postconfirmed" | "denied" | "completed" | "cancelled",
      newStatus,
      noteToPlayer: noteToPlayer || null,
      internalNote: internalNote ?? null,
      emailSentToPlayer: false,
    })
    .returning({ id: transactionUpdates.id });

  const [player] = await db
    .select({ id: cashierUsers.id })
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
    body: noteToPlayer || `Transaction ${tx.referenceCode} status updated to ${newStatus}.`,
  });

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: actor.id,
    actorRole: actor.masterRole ? null : "clerk",
    action: "transaction.status_updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousStatus,
      newStatus,
      actorId: actor.id,
      actorName: [actor.firstName, actor.lastName].filter(Boolean).join(" ") || actor.username,
      isMasterActor: actor.masterRole != null,
      masterRole: actor.masterRole,
      changed_by_username: actor.username,
      changed_by_role: actor.masterRole ?? actor.role,
    },
  });

  if (isTerminal) {
    await releasePoolLocks(transactionId);
  }

  revalidatePath("/clerk/queue");
  return { success: true };
}
