"use server";

import { z } from "zod";
import { db } from "@/db";
import {
  transactions,
  transactionUpdates,
  notifications,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { releasePoolLocks } from "@/data/names-pool";
import { TERMINAL_STATUSES, NEXT_STATUSES_ADMIN } from "@/lib/transaction-statuses";

type ActionResult = { success: true } | { success: false; error: string };

const updateSchema = z
  .object({
    transactionId: z.string().uuid(),
    newStatus: z.enum(["preconfirmed", "postconfirmed", "denied", "completed"]),
    noteToPlayer: z.string().optional().default(""),
    internalNote: z.string().optional(),
    deniedReason: z.string().optional(),
  })
  .refine(
    (d) => d.newStatus !== "denied" || (!!d.deniedReason && d.deniedReason.trim().length >= 3),
    { message: "Denial reason is required when denying a transaction", path: ["deniedReason"] },
  );

export async function masterUpdateTransactionStatusAction(input: unknown): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };

  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_admin") return { success: false, error: "Unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote, deniedReason } = parsed.data;

  const [tx] = await db
    .select({
      cashierId: transactions.cashierId,
      status: transactions.status,
      playerId: transactions.playerId,
      referenceCode: transactions.referenceCode,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };
  if (TERMINAL_STATUSES.includes(tx.status as never)) {
    return { success: false, error: "This transaction has already been finalized." };
  }

  const allowed = (NEXT_STATUSES_ADMIN[tx.status] ?? []).map((s) => s.value);
  if (!allowed.includes(newStatus as never)) {
    return { success: false, error: `Cannot transition from ${tx.status} to ${newStatus}.` };
  }

  const previousStatus = tx.status;
  const cashierId = tx.cashierId;
  const now = new Date();
  const isTerminal = TERMINAL_STATUSES.includes(newStatus as never);
  const wasUnassigned = previousStatus === "unassigned";

  await db
    .update(transactions)
    .set({
      status: newStatus,
      internalNote: internalNote ?? null,
      ...(newStatus === "denied" ? { deniedReason: deniedReason ?? null } : {}),
      ...(wasUnassigned ? { assignedAt: now } : {}),
      ...(newStatus === "preconfirmed" ? { preconfirmedAt: now } : {}),
      ...(newStatus === "postconfirmed" ? { postconfirmedAt: now } : {}),
      ...(newStatus === "completed" ? { completedAt: now } : {}),
      ...(newStatus === "denied" ? { deniedAt: now } : {}),
      ...(isTerminal ? { lockedByClerkId: null, lockedAt: null, lockExpiresAt: null } : {}),
      updatedAt: now,
    })
    .where(eq(transactions.id, transactionId));

  const [update] = await db
    .insert(transactionUpdates)
    .values({
      cashierId,
      transactionId,
      updatedByUserId: null,
      previousStatus: previousStatus as never,
      newStatus,
      noteToPlayer: noteToPlayer || null,
      internalNote: internalNote || null,
      emailSentToPlayer: false,
    })
    .returning({ id: transactionUpdates.id });

  await db.insert(notifications).values({
    cashierId,
    userId: tx.playerId,
    transactionId,
    transactionUpdateId: update.id,
    channel: "in_app",
    title: `Transaction ${tx.referenceCode} Updated`,
    body: noteToPlayer || `Transaction ${tx.referenceCode} status updated to ${newStatus}.`,
  });

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: null,
    actorRole: null,
    action: "transaction.status_updated",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousStatus,
      newStatus,
      masterUserId: session.masterUserId ?? "env_root",
      masterRole: session.role,
      source: "master_queue",
    },
  });

  if (isTerminal) {
    await releasePoolLocks(transactionId);
  }

  return { success: true };
}
