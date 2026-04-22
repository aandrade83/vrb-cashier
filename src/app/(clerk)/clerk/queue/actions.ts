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
  masterUsers,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getClerkById } from "@/data/queue";
import { getCashierId } from "@/lib/cashier-context";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { releasePoolLocks } from "@/data/names-pool";
import { TERMINAL_STATUSES } from "@/lib/transaction-statuses";

type ActionResult = { success: true } | { success: false; error: string };

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; username: string | null; lockedAt: Date | null } };

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function requireClerk(cashierId: string) {
  const session = await getUserSession();
  if (!session || session.role !== "clerk" || session.cashierId !== cashierId) return null;
  return getClerkById(session.userId, cashierId);
}

async function isMasterActingAsClerk(cashierId: string): Promise<boolean> {
  const session = await getMasterSession();
  return !!(session?.actingCashierId === cashierId && session.actingRole === "clerk");
}

// Returns "master_admin" | "master_clerk" | null (null = not a master session)
async function getActingMasterRole(cashierId: string): Promise<"master_admin" | "master_clerk" | null> {
  const session = await getMasterSession();
  if (!session || session.actingCashierId !== cashierId) return null;
  // ENV root (no masterUserId) is always master_admin
  if (!session.masterUserId) return "master_admin";
  const [user] = await db
    .select({ role: masterUsers.role })
    .from(masterUsers)
    .where(eq(masterUsers.id, session.masterUserId))
    .limit(1);
  return (user?.role as "master_admin" | "master_clerk") ?? "master_clerk";
}

// ─── Lock ─────────────────────────────────────────────────────────────────────

export async function lockTransactionAction(transactionId: string): Promise<LockResult> {
  const cashierId = await getCashierId();
  const clerk = await requireClerk(cashierId);
  if (!clerk) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };

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
  const isOwnLock = tx.lockedByClerkId === clerk.id;

  if (isFree || isOwnLock) {
    const now = new Date();
    const isFirstAssignment = isFree && !isOwnLock && tx.status === "unassigned";

    const lockUpdated = await db
      .update(transactions)
      .set({
        lockedByClerkId: clerk.id,
        lockedAt: now,
        lockExpiresAt: null,
        ...(isFirstAssignment ? { status: "pending", assignedAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
      .returning({ id: transactions.id });

    console.log("[lock] transactionId=%s cashierId=%s clerkId=%s isFirstAssignment=%s rowsAffected=%d", transactionId, cashierId, clerk.id, isFirstAssignment, lockUpdated.length);

    if (lockUpdated.length === 0) {
      return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };
    }

    if (isFirstAssignment) {
      await db.insert(auditLogs).values({
        cashierId,
        actorUserId: clerk.id,
        actorRole: "clerk",
        action: "transaction.assigned",
        entityType: "transaction",
        entityId: transactionId,
        metadata: {
          clerkId: clerk.id,
          clerkName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || clerk.username,
          changed_by_username: clerk.username,
          changed_by_role: clerk.role,
        },
      });
    }

    return { acquired: true, lockedByClerkId: clerk.id };
  }

  // Transaction is locked by a different clerk — return their info
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
  const masterActing = await isMasterActingAsClerk(cashierId);
  const now = new Date();

  if (masterActing) {
    const masterSession = await getMasterSession();
    const masterRole = await getActingMasterRole(cashierId);

    let masterUsername: string | null = null;
    if (masterSession?.masterUserId) {
      const [mu] = await db
        .select({ username: masterUsers.username })
        .from(masterUsers)
        .where(eq(masterUsers.id, masterSession.masterUserId))
        .limit(1);
      masterUsername = mu?.username ?? null;
    } else if (masterSession) {
      masterUsername = "ENV Root";
    }

    const [tx] = await db
      .select({ lockedByClerkId: transactions.lockedByClerkId, status: transactions.status })
      .from(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
      .limit(1);

    if (!tx) return { success: false, error: "Transaction not found" };

    const wasUnassigned = tx.status === "unassigned";

    const masterUpdated = await db
      .update(transactions)
      .set({
        lockedByClerkId: null,
        lockedAt: null,
        lockExpiresAt: null,
        ...(wasUnassigned ? { status: "pending", assignedAt: now } : {}),
        updatedAt: now,
      })
      .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
      .returning({ id: transactions.id });

    console.log("[takeOver/master] transactionId=%s cashierId=%s masterUsername=%s rowsAffected=%d", transactionId, cashierId, masterUsername, masterUpdated.length);

    if (masterUpdated.length === 0) {
      return { success: false, error: "Transaction not found or cashier mismatch — no rows updated." };
    }

    await db.insert(auditLogs).values({
      cashierId,
      actorUserId: null,
      actorRole: null,
      action: "transaction.taken_over",
      entityType: "transaction",
      entityId: transactionId,
      metadata: {
        previousAssignedUserId: tx.lockedByClerkId ?? null,
        newAssignedUserId: null,
        isMasterActing: true,
        masterRole,
        changed_by_username: masterUsername,
        changed_by_role: masterRole ?? "master_clerk",
        takenOverAt: now.toISOString(),
      },
    });

    revalidatePath("/clerk/queue");
    revalidatePath(`/clerk/queue/${transactionId}`);
    return { success: true };
  }

  const clerk = await requireClerk(cashierId);
  console.log("[takeOver/clerk] transactionId=%s cashierId=%s clerkId=%s", transactionId, cashierId, clerk?.id ?? "null — requireClerk returned null");
  if (!clerk) return { success: false, error: "Unauthorized — clerk session not found for this cashier." };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId, status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found." };

  const wasUnassigned = tx.status === "unassigned";

  const clerkUpdated = await db
    .update(transactions)
    .set({
      lockedByClerkId: clerk.id,
      lockedAt: now,
      lockExpiresAt: null,
      ...(wasUnassigned ? { status: "pending", assignedAt: now } : {}),
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .returning({ id: transactions.id });

  console.log("[takeOver/clerk] rowsAffected=%d lockedByClerkId=%s", clerkUpdated.length, clerk.id);

  if (clerkUpdated.length === 0) {
    return { success: false, error: "Transaction not found or cashier mismatch — no rows updated." };
  }

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: clerk.id,
    actorRole: "clerk",
    action: "transaction.taken_over",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousAssignedUserId: tx.lockedByClerkId ?? null,
      newAssignedUserId: clerk.id,
      newAssignedUserName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || clerk.username,
      changed_by_username: clerk.username,
      changed_by_role: clerk.role,
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
    noteToPlayer: z.string().min(10, "Note to player must be at least 10 characters"),
    internalNote: z.string().optional(),
    deniedReason: z.string().min(3, "Denial reason is required").optional(),
  })
  .refine(
    (d) => d.newStatus !== "denied" || (!!d.deniedReason && d.deniedReason.trim().length >= 3),
    { message: "Denial reason is required when denying a transaction", path: ["deniedReason"] },
  );

export async function updateTransactionStatusAction(input: unknown): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const masterActing = await isMasterActingAsClerk(cashierId);
  const masterRole = masterActing ? await getActingMasterRole(cashierId) : null;
  const clerk = masterActing ? null : await requireClerk(cashierId);

  // Resolve master username for audit log
  let masterUsername: string | null = null;
  if (masterActing) {
    const masterSession = await getMasterSession();
    if (masterSession?.masterUserId) {
      const [mu] = await db
        .select({ username: masterUsers.username })
        .from(masterUsers)
        .where(eq(masterUsers.id, masterSession.masterUserId))
        .limit(1);
      masterUsername = mu?.username ?? null;
    } else if (masterSession) {
      masterUsername = "ENV Root";
    }
  }

  if (!masterActing && !clerk) return { success: false, error: "Unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote, deniedReason } = parsed.data;

  // Only master_admin can complete a postconfirmed transaction
  if (newStatus === "completed" && masterRole !== "master_admin") {
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

  // Clerk must own the lock (master bypasses this)
  if (!masterActing && tx.lockedByClerkId !== clerk!.id) {
    return { success: false, error: "You do not own the lock on this transaction." };
  }

  const previousStatus = tx.status;
  const now = new Date();

  // Timestamp fields to set based on new status
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
      // Only clear lock on terminal statuses; non-terminal keeps the clerk assigned
      ...(isTerminal ? { lockedByClerkId: null, lockedAt: null, lockExpiresAt: null } : {}),
      updatedAt: now,
    })
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)));

  const [update] = await db
    .insert(transactionUpdates)
    .values({
      cashierId,
      transactionId,
      updatedByUserId: clerk?.id ?? null,
      previousStatus: previousStatus as "unassigned" | "pending" | "preconfirmed" | "postconfirmed" | "denied" | "completed" | "cancelled",
      newStatus,
      noteToPlayer,
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
    body: noteToPlayer,
  });

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: clerk?.id ?? null,
    actorRole: masterActing ? null : "clerk",
    action: "transaction.status_updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousStatus,
      newStatus,
      clerkId: clerk?.id ?? null,
      clerkName: clerk ? ([clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || clerk.username) : null,
      isMasterActing: masterActing,
      masterRole,
      changed_by_username: masterActing ? masterUsername : (clerk?.username ?? null),
      changed_by_role: masterActing ? (masterRole ?? "master_clerk") : (clerk?.role ?? "clerk"),
    },
  });

  if (isTerminal) {
    await releasePoolLocks(transactionId);
  }

  revalidatePath("/clerk/queue");
  return { success: true };
}
