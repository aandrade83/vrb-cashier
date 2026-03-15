"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  transactions,
  transactionUpdates,
  notifications,
  auditLogs,
  users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getClerkByClerkId } from "@/data/queue";
// import { sendStatusUpdateEmail } from "@/lib/email/sendStatusUpdate"; // TODO: re-enable when email provider is configured

type ActionResult = { success: true } | { success: false; error: string };

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; lockedAt: Date | null } };

async function requireClerk() {
  const { sessionClaims, userId } = await auth();
  if (sessionClaims?.public_metadata?.role !== "clerk" || !userId) return null;
  return userId;
}

// ─── Lock ─────────────────────────────────────────────────────────────────────

export async function lockTransactionAction(transactionId: string): Promise<LockResult> {
  const clerkAuthId = await requireClerk();
  if (!clerkAuthId) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, lockedAt: null } };

  const clerk = await getClerkByClerkId(clerkAuthId);
  if (!clerk) return { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, lockedAt: null } };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId, lockExpiresAt: transactions.lockExpiresAt, status: transactions.status })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
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
      .where(eq(transactions.id, transactionId));

    if (isFree && !isOwnLock) {
      await db.insert(auditLogs).values({
        actorUserId: clerk.id,
        action: "transaction.locked",
        entityType: "transaction",
        entityId: transactionId,
        metadata: { clerkId: clerk.id, clerkName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") },
      });
    }

    return { acquired: true, lockedByClerkId: clerk.id };
  }

  // Locked by a different clerk — fetch their info
  const [lockHolder] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, tx.lockedByClerkId!))
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
  const clerkAuthId = await requireClerk();
  if (!clerkAuthId) return { success: false, error: "Unauthorized" };

  const clerk = await getClerkByClerkId(clerkAuthId);
  if (!clerk) return { success: false, error: "Clerk account not found" };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
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
    .where(eq(transactions.id, transactionId));

  await db.insert(auditLogs).values({
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
  const clerkAuthId = await requireClerk();
  if (!clerkAuthId) return { success: false, error: "Unauthorized" };

  const clerk = await getClerkByClerkId(clerkAuthId);
  if (!clerk) return { success: false, error: "Clerk account not found" };

  const [tx] = await db
    .select({ lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (tx?.lockedByClerkId !== clerk.id) return { success: false, error: "You do not own this lock" };

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await db
    .update(transactions)
    .set({ lockExpiresAt: expiresAt })
    .where(eq(transactions.id, transactionId));

  return { success: true };
}

// ─── Update Status ────────────────────────────────────────────────────────────

const updateSchema = z.object({
  transactionId: z.string().uuid(),
  newStatus: z.enum(["in_progress", "approved", "rejected", "completed"]),
  noteToPlayer: z.string().min(10, "Note to player must be at least 10 characters"),
  internalNote: z.string().optional(),
});

const TERMINAL_STATUSES = ["completed", "rejected"];

export async function updateTransactionStatusAction(
  input: unknown
): Promise<ActionResult> {
  const clerkAuthId = await requireClerk();
  if (!clerkAuthId) return { success: false, error: "Unauthorized" };

  const clerk = await getClerkByClerkId(clerkAuthId);
  if (!clerk) return { success: false, error: "Clerk account not found" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote } = parsed.data;

  // Fetch current transaction state
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
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };

  // Verify lock ownership
  if (tx.lockedByClerkId !== clerk.id) {
    return { success: false, error: "You do not own the lock on this transaction." };
  }

  // Verify not terminal
  if (TERMINAL_STATUSES.includes(tx.status)) {
    return { success: false, error: "This transaction has already been finalized and cannot be updated." };
  }

  const previousStatus = tx.status;
  const now = new Date();

  // Update transaction — release lock
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
    .where(eq(transactions.id, transactionId));

  // Insert transaction_updates row
  const [update] = await db
    .insert(transactionUpdates)
    .values({
      transactionId,
      updatedByUserId: clerk.id,
      previousStatus: previousStatus as "pending" | "in_progress" | "approved" | "rejected" | "completed" | "cancelled",
      newStatus,
      noteToPlayer,
      internalNote: internalNote ?? null,
      emailSentToPlayer: false,
    })
    .returning({ id: transactionUpdates.id });

  // Get player for in-app notification
  const [player] = await db
    .select({ id: users.id, email: users.email, firstName: users.firstName })
    .from(users)
    .where(eq(users.id, tx.playerId))
    .limit(1);

  // TODO: Send email notification to player when email provider is configured
  // const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  // const emailResult = await sendStatusUpdateEmail({
  //   playerEmail: player.email,
  //   playerFirstName: player.firstName,
  //   referenceCode: tx.referenceCode,
  //   type: tx.type,
  //   amount: tx.amount,
  //   currency: tx.currency,
  //   newStatus,
  //   noteToPlayer,
  //   appUrl,
  // });
  // if (emailResult.success) {
  //   await db
  //     .update(transactionUpdates)
  //     .set({ emailSentToPlayer: true, emailSentAt: now })
  //     .where(eq(transactionUpdates.id, update.id));
  // } else {
  //   await db
  //     .update(transactionUpdates)
  //     .set({ emailError: emailResult.error })
  //     .where(eq(transactionUpdates.id, update.id));
  // }

  // Insert in-app notification for player
  await db.insert(notifications).values({
    userId: player.id,
    transactionId,
    transactionUpdateId: update.id,
    channel: "in_app",
    title: `Transaction ${tx.referenceCode} Updated`,
    body: noteToPlayer,
  });

  // Audit log
  await db.insert(auditLogs).values({
    actorUserId: clerk.id,
    actorRole: "clerk",
    action: "transaction.status_updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousStatus,
      newStatus,
      clerkId: clerk.id,
      clerkName: [clerk.firstName, clerk.lastName].filter(Boolean).join(" "),
    },
  });

  revalidatePath("/clerk/queue");
  return { success: true };
}
