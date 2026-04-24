"use server";

import { z } from "zod";
import { db } from "@/db";
import {
  transactions,
  transactionUpdates,
  notifications,
  auditLogs,
  cashierUsers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { releasePoolLocks } from "@/data/names-pool";
import { getPlayerCompletedDepositSummary, type PlayerDepositSummaryRow } from "@/data/queue";
import { TERMINAL_STATUSES, NEXT_STATUSES_ADMIN, TX_STATUS_LABEL } from "@/lib/transaction-statuses";
import { getAdminEmailsForCashier } from "@/data/master-users";
import { getCashierById } from "@/data/cashiers";
import { sendTransactionStatusUpdateEmail } from "@/lib/email";
import { and } from "drizzle-orm";
import { masterUsers } from "@/db/schema";

type ActionResult = { success: true } | { success: false; error: string };

const updateSchema = z
  .object({
    transactionId: z.string().uuid(),
    newStatus: z.enum(["preconfirmed", "postconfirmed", "denied", "completed"]).optional(),
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
      type: transactions.type,
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

  const previousStatus = tx.status;
  const cashierId = tx.cashierId;
  const now = new Date();

  if (!newStatus) {
    // Notes-only update — just persist the internal note, no status transition
    if (internalNote !== undefined) {
      await db
        .update(transactions)
        .set({ internalNote: internalNote || null, updatedAt: now })
        .where(eq(transactions.id, transactionId));
    }
    return { success: true };
  }

  const allowed = (NEXT_STATUSES_ADMIN[tx.status] ?? []).map((s) => s.value);
  if (!allowed.includes(newStatus as never)) {
    return { success: false, error: `Cannot transition from ${tx.status} to ${newStatus}.` };
  }

  // Resolve shadow admin row so the history shows the real account name
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

  const [existingShadow] = await db
    .select({ id: cashierUsers.id })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, shadowUsername)))
    .limit(1);

  let shadowAdminId: string;
  if (existingShadow) {
    shadowAdminId = existingShadow.id;
  } else {
    const [created] = await db
      .insert(cashierUsers)
      .values({
        cashierId,
        username: shadowUsername,
        passwordHash: "!disabled",
        role: "admin",
        firstName: masterUsername === "root" ? "ENV Root" : masterUsername,
        lastName: null,
        isActive: true,
      })
      .returning({ id: cashierUsers.id });
    shadowAdminId = created.id;
  }

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
      updatedByUserId: shadowAdminId,
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
      console.error("[master_queue] status update email failed:", err);
    }
  })();

  return { success: true };
}

// ── Take / Take Over (admin assigns to themselves) ───────────────────────────

export async function masterAdminTakeTransactionAction(input: {
  transactionId: string;
}): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };

  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_admin") return { success: false, error: "Unauthorized" };

  const parsed = z.object({ transactionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid input" };

  const { transactionId } = parsed.data;

  const [tx] = await db
    .select({ cashierId: transactions.cashierId, status: transactions.status, lockedByClerkId: transactions.lockedByClerkId })
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!tx) return { success: false, error: "Transaction not found" };
  if (TERMINAL_STATUSES.includes(tx.status as never)) {
    return { success: false, error: "Transaction is already finalized." };
  }

  // Resolve shadow admin row for this master user
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

  let shadowId: string;
  if (existing) {
    shadowId = existing.id;
  } else {
    const [created] = await db
      .insert(cashierUsers)
      .values({
        cashierId,
        username: shadowUsername,
        passwordHash: "!disabled",
        role: "admin",
        firstName: masterUsername === "root" ? "ENV Root" : masterUsername,
        lastName: null,
        isActive: true,
      })
      .returning({ id: cashierUsers.id });
    shadowId = created.id;
  }

  const now = new Date();
  const lockExpires = new Date(now.getTime() + 30 * 60 * 1000);
  const isUnassigned = tx.status === "unassigned";

  await db
    .update(transactions)
    .set({
      lockedByClerkId: shadowId,
      lockedAt: now,
      lockExpiresAt: lockExpires,
      status: isUnassigned ? "pending" : tx.status,
      ...(isUnassigned ? { assignedAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(transactions.id, transactionId));

  if (isUnassigned) {
    await db.insert(transactionUpdates).values({
      cashierId,
      transactionId,
      updatedByUserId: shadowId,
      previousStatus: "unassigned" as never,
      newStatus: "pending" as never,
      noteToPlayer: null,
      internalNote: null,
      emailSentToPlayer: false,
    });
  }

  await db.insert(auditLogs).values({
    cashierId,
    actorUserId: shadowId,
    actorRole: "admin",
    action: "transaction.assigned",
    entityType: "transaction",
    entityId: transactionId,
    metadata: {
      previousClerkId: tx.lockedByClerkId ?? null,
      masterUserId: session.masterUserId ?? "env_root",
      shadowUsername,
      source: "master_admin_take",
    },
  });

  return { success: true };
}

export async function getPlayerDepositSummaryAction(
  playerId: string,
  cashierId: string,
): Promise<{ success: true; rows: PlayerDepositSummaryRow[] } | { success: false; error: string }> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };
  const session = await getMasterSessionData(token);
  if (!session) return { success: false, error: "Unauthorized" };

  const rows = await getPlayerCompletedDepositSummary(playerId, cashierId);
  return { success: true, rows };
}
