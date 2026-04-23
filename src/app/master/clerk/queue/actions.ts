"use server";

import { z } from "zod";
import { db } from "@/db";
import { transactions, transactionUpdates, notifications, auditLogs, cashierUsers, masterUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { releasePoolLocks } from "@/data/names-pool";
import { TERMINAL_STATUSES, NEXT_STATUSES_CLERK, TX_STATUS_LABEL } from "@/lib/transaction-statuses";
import { getAdminEmailsForCashier } from "@/data/master-users";
import { getCashierById } from "@/data/cashiers";
import { sendTransactionStatusUpdateEmail } from "@/lib/email";

type ActionResult = { success: true } | { success: false; error: string };

const updateSchema = z
  .object({
    transactionId: z.string().uuid(),
    newStatus: z.enum(["preconfirmed", "postconfirmed", "denied"]).optional(),
    noteToPlayer: z.string().optional().default(""),
    internalNote: z.string().optional(),
    deniedReason: z.string().optional(),
  })
  .refine(
    (d) => d.newStatus !== "denied" || (!!d.deniedReason && d.deniedReason.trim().length >= 3),
    { message: "Denial reason is required when denying a transaction", path: ["deniedReason"] },
  );

export async function masterClerkUpdateTransactionStatusAction(
  input: unknown,
): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };

  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_clerk") return { success: false, error: "Unauthorized" };

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { transactionId, newStatus, noteToPlayer, internalNote, deniedReason } = parsed.data;

  const [tx] = await db
    .select({
      cashierId: transactions.cashierId,
      type: transactions.type,
      status: transactions.status,
      playerId: transactions.playerId,
      referenceCode: transactions.referenceCode,
    })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };

  if (session.masterUserId) {
    const permittedIds = await getUserCashierPermissions(session.masterUserId);
    if (!permittedIds.includes(tx.cashierId)) {
      return { success: false, error: "Unauthorized" };
    }
  }

  if (TERMINAL_STATUSES.includes(tx.status as never)) {
    return { success: false, error: "This transaction has already been finalized." };
  }

  const previousStatus = tx.status;
  const cashierId = tx.cashierId;
  const now = new Date();

  if (!newStatus) {
    // Notes-only update — persist internal note only
    if (internalNote !== undefined) {
      await db
        .update(transactions)
        .set({ internalNote: internalNote || null, updatedAt: now })
        .where(eq(transactions.id, transactionId));
    }
    return { success: true };
  }

  const allowed = (NEXT_STATUSES_CLERK[tx.status] ?? []).map((s) => s.value);
  if (!allowed.includes(newStatus as never)) {
    return { success: false, error: `Cannot transition from ${tx.status} to ${newStatus}.` };
  }

  const isTerminal = TERMINAL_STATUSES.includes(newStatus as never);

  await db
    .update(transactions)
    .set({
      status: newStatus,
      internalNote: internalNote ?? null,
      ...(newStatus === "denied" ? { deniedReason: deniedReason ?? null } : {}),
      ...(newStatus === "preconfirmed" ? { preconfirmedAt: now } : {}),
      ...(newStatus === "postconfirmed" ? { postconfirmedAt: now } : {}),
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
      masterUserId: session.masterUserId,
      masterRole: session.role,
      source: "master_clerk_queue",
    },
  });

  if (isTerminal) await releasePoolLocks(transactionId);

  // Fire-and-forget status update emails to player + admins
  void (async () => {
    try {
      const [playerRow, adminEmails, cashier] = await Promise.all([
        db.select({ email: cashierUsers.email }).from(cashierUsers).where(eq(cashierUsers.id, tx.playerId)).limit(1),
        getAdminEmailsForCashier(cashierId),
        getCashierById(cashierId),
      ]);
      if (!cashier) return;
      const newStatusLabel = TX_STATUS_LABEL[newStatus as keyof typeof TX_STATUS_LABEL] ?? newStatus;
      const recipients = [
        ...(playerRow[0]?.email ? [playerRow[0].email] : []),
        ...adminEmails,
      ];
      if (recipients.length > 0) {
        await sendTransactionStatusUpdateEmail({
          to: recipients,
          cashierName: cashier.name,
          referenceCode: tx.referenceCode,
          transactionType: tx.type as "deposit" | "payout",
          newStatusLabel,
          noteToPlayer: noteToPlayer || null,
        });
      }
    } catch (err) {
      console.error("[master_clerk_queue] status update email failed:", err);
    }
  })();

  return { success: true };
}

export async function masterClerkTakeTransactionAction(input: {
  transactionId: string;
}): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };

  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_clerk") return { success: false, error: "Unauthorized" };

  const parsed = z.object({ transactionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { transactionId } = parsed.data;

  const [tx] = await db
    .select({ cashierId: transactions.cashierId, status: transactions.status, lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };

  if (session.masterUserId) {
    const permittedIds = await getUserCashierPermissions(session.masterUserId);
    if (!permittedIds.includes(tx.cashierId)) return { success: false, error: "Unauthorized" };
  }

  if (TERMINAL_STATUSES.includes(tx.status as never))
    return { success: false, error: "This transaction has already been finalized." };

  // Resolve shadow clerk row for this master user
  let masterUsername: string;
  if (!session.masterUserId) {
    masterUsername = "root";
  } else {
    const [mu] = await db
      .select({ username: masterUsers.username })
      .from(masterUsers)
      .where(eq(masterUsers.id, session.masterUserId))
      .limit(1);
    if (!mu) return { success: false, error: "Session user not found" };
    masterUsername = mu.username;
  }

  const shadowUsername = `__m__${masterUsername}`;
  const cashierId = tx.cashierId;

  const [existing] = await db
    .select({ id: cashierUsers.id })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, shadowUsername)))
    .limit(1);

  let shadowClerkId: string;
  if (existing) {
    shadowClerkId = existing.id;
  } else {
    const [created] = await db
      .insert(cashierUsers)
      .values({
        cashierId,
        username: shadowUsername,
        passwordHash: "!disabled",
        role: "clerk",
        firstName: masterUsername === "root" ? "ENV Root" : masterUsername,
        lastName: null,
        isActive: true,
      })
      .returning({ id: cashierUsers.id });
    shadowClerkId = created.id;
  }

  const now = new Date();
  const lockExpires = new Date(now.getTime() + 30 * 60 * 1000);
  const isUnassigned = tx.status === "unassigned";
  const newStatus = isUnassigned ? "pending" : tx.status;

  await db
    .update(transactions)
    .set({
      lockedByClerkId: shadowClerkId,
      lockedAt: now,
      lockExpiresAt: lockExpires,
      status: newStatus,
      ...(isUnassigned ? { assignedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(transactions.id, transactionId));

  if (isUnassigned) {
    await db.insert(transactionUpdates).values({
      cashierId,
      transactionId,
      updatedByUserId: shadowClerkId,
      previousStatus: "unassigned" as never,
      newStatus: "pending" as never,
      noteToPlayer: null,
      internalNote: null,
      emailSentToPlayer: false,
    });
  }

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: shadowClerkId,
    actorRole: "clerk",
    action: "transaction.assigned",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousClerkId: tx.lockedByClerkId ?? null,
      masterUserId: session.masterUserId ?? null,
      masterRole: session.role,
      shadowUsername,
      source: "master_clerk_take",
    },
  });

  return { success: true };
}
