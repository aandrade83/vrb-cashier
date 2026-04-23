import { db } from "@/db";
import {
  transactions,
  cashierUsers,
  cashiers,
  paymentMethods,
  transactionFieldValues,
  transactionAttachments,
  transactionUpdates,
} from "@/db/schema";
import { eq, inArray, desc, asc, and } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ACTIVE_STATUSES } from "@/lib/transaction-statuses";

// Shadow player accounts (`__mp__*`) should never expose internal usernames or
// auto-generated display names to clerks/admins. Normalize them to "TestAccount".
function maskShadow<T extends { playerUsername?: string | null; playerFirstName?: string | null; playerLastName?: string | null }>(row: T): T {
  if (row.playerUsername?.startsWith("__mp__")) {
    return { ...row, playerUsername: null, playerFirstName: "TestAccount", playerLastName: null };
  }
  return row;
}

// ─── Queue list row ────────────────────────────────────────────────────────────

export type QueueTransaction = {
  id: string;
  referenceCode: string;
  type: "deposit" | "payout";
  status: string;
  amount: string;
  currency: string;
  methodName: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  playerEmail: string | null;
  playerUsername: string | null;
  lockedByClerkId: string | null;
  lockedByClerkFirstName: string | null;
  lockedByClerkLastName: string | null;
  lockedByClerkUsername: string | null;
  lockedAt: Date | null;
  createdAt: Date;
};

function queueSelect(clerkUser: ReturnType<typeof alias>) {
  return {
    id: transactions.id,
    referenceCode: transactions.referenceCode,
    type: transactions.type,
    status: transactions.status,
    amount: transactions.amount,
    currency: transactions.currency,
    methodName: paymentMethods.name,
    playerFirstName: cashierUsers.firstName,
    playerLastName: cashierUsers.lastName,
    playerEmail: cashierUsers.email,
    playerUsername: cashierUsers.username,
    lockedByClerkId: transactions.lockedByClerkId,
    lockedByClerkFirstName: clerkUser.firstName,
    lockedByClerkLastName: clerkUser.lastName,
    lockedByClerkUsername: clerkUser.username,
    lockedAt: transactions.lockedAt,
    createdAt: transactions.createdAt,
  };
}

export async function getPendingTransactions(cashierId: string): Promise<QueueTransaction[]> {
  const clerkUser = alias(cashierUsers, "clerk_user");
  const rows = await db
    .select(queueSelect(clerkUser))
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(eq(transactions.cashierId, cashierId), inArray(transactions.status, ACTIVE_STATUSES)))
    .orderBy(asc(transactions.createdAt));
  return rows.map(maskShadow);
}

export async function getRecentTransactions(
  cashierId: string,
  statuses: string[],
  type: "deposit" | "payout",
  limit = 10,
): Promise<QueueTransaction[]> {
  const clerkUser = alias(cashierUsers, "clerk_user");
  const rows = await db
    .select(queueSelect(clerkUser))
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(
      eq(transactions.cashierId, cashierId),
      inArray(transactions.status, statuses as ["completed" | "denied"]),
      eq(transactions.type, type),
    ))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
  return rows.map(maskShadow);
}

// ─── Transaction detail ────────────────────────────────────────────────────────

export type TransactionDetail = {
  id: string;
  referenceCode: string;
  type: "deposit" | "payout";
  status: string;
  amount: string;
  currency: string;
  internalNote: string | null;
  deniedReason: string | null;
  methodName: string;
  methodType: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  playerEmail: string | null;
  lockedByClerkId: string | null;
  lockedByClerkFirstName: string | null;
  lockedByClerkLastName: string | null;
  lockedByClerkUsername: string | null;
  lockedAt: Date | null;
  assignedAt: Date | null;
  preconfirmedAt: Date | null;
  postconfirmedAt: Date | null;
  completedAt: Date | null;
  deniedAt: Date | null;
  createdAt: Date;
  fieldValues: {
    id: string;
    fieldLabelSnapshot: string;
    fieldTypeSnapshot: string;
    value: string | null;
  }[];
  attachments: {
    id: string;
    fileName: string;
    fileType: string;
    fileUrl: string;
  }[];
  updates: {
    id: string;
    clerkFirstName: string | null;
    clerkLastName: string | null;
    previousStatus: string;
    newStatus: string;
    noteToPlayer: string | null;
    internalNote: string | null;
    createdAt: Date;
  }[];
};

export async function getTransactionDetail(
  transactionId: string,
  cashierId: string,
): Promise<TransactionDetail | null> {
  const clerkUser = alias(cashierUsers, "clerk_user");
  const updateClerk = alias(cashierUsers, "update_clerk");

  const [row] = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      internalNote: transactions.internalNote,
      deniedReason: transactions.deniedReason,
      methodName: paymentMethods.name,
      methodType: paymentMethods.type,
      playerFirstName: cashierUsers.firstName,
      playerLastName: cashierUsers.lastName,
      playerEmail: cashierUsers.email,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedByClerkUsername: clerkUser.username,
      lockedAt: transactions.lockedAt,
      assignedAt: transactions.assignedAt,
      preconfirmedAt: transactions.preconfirmedAt,
      postconfirmedAt: transactions.postconfirmedAt,
      completedAt: transactions.completedAt,
      deniedAt: transactions.deniedAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!row) return null;

  const [fieldValues, attachments, updatesRaw] = await Promise.all([
    db
      .select({
        id: transactionFieldValues.id,
        fieldLabelSnapshot: transactionFieldValues.fieldLabelSnapshot,
        fieldTypeSnapshot: transactionFieldValues.fieldTypeSnapshot,
        value: transactionFieldValues.value,
      })
      .from(transactionFieldValues)
      .where(eq(transactionFieldValues.transactionId, transactionId)),

    db
      .select({
        id: transactionAttachments.id,
        fileName: transactionAttachments.fileName,
        fileType: transactionAttachments.fileType,
        fileUrl: transactionAttachments.fileUrl,
      })
      .from(transactionAttachments)
      .where(eq(transactionAttachments.transactionId, transactionId)),

    db
      .select({
        id: transactionUpdates.id,
        clerkFirstName: updateClerk.firstName,
        clerkLastName: updateClerk.lastName,
        previousStatus: transactionUpdates.previousStatus,
        newStatus: transactionUpdates.newStatus,
        noteToPlayer: transactionUpdates.noteToPlayer,
        internalNote: transactionUpdates.internalNote,
        createdAt: transactionUpdates.createdAt,
      })
      .from(transactionUpdates)
      .leftJoin(updateClerk, eq(transactionUpdates.updatedByUserId, updateClerk.id))
      .where(eq(transactionUpdates.transactionId, transactionId))
      .orderBy(desc(transactionUpdates.createdAt)),
  ]);

  return { ...row, fieldValues, attachments, updates: updatesRaw };
}

// ─── Multi-cashier queue (for master clerk dashboard) ─────────────────────────

export type MultiQueueTransaction = QueueTransaction & {
  cashierId: string;
  cashierName: string;
  cashierSlug: string;
  cashierToken: string;
};

function multiQueueSelect(clerkUser: ReturnType<typeof alias>) {
  return {
    ...queueSelect(clerkUser),
    cashierId: transactions.cashierId,
    cashierName: cashiers.name,
    cashierSlug: cashiers.slug,
    cashierToken: cashiers.token,
  };
}

export async function getPendingTransactionsMulti(
  cashierIds: string[],
): Promise<MultiQueueTransaction[]> {
  if (cashierIds.length === 0) return [];
  const clerkUser = alias(cashierUsers, "clerk_user");
  const rows = await db
    .select(multiQueueSelect(clerkUser))
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(
      inArray(transactions.cashierId, cashierIds),
      inArray(transactions.status, ACTIVE_STATUSES),
    ))
    .orderBy(asc(transactions.createdAt));
  return (rows as MultiQueueTransaction[]).map(maskShadow);
}

export async function getRecentTransactionsMulti(
  cashierIds: string[],
  limit = 20,
): Promise<MultiQueueTransaction[]> {
  if (cashierIds.length === 0) return [];
  const clerkUser = alias(cashierUsers, "clerk_user");
  const rows = await db
    .select(multiQueueSelect(clerkUser))
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(
      inArray(transactions.cashierId, cashierIds),
      inArray(transactions.status, ["completed", "denied"]),
    ))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
  return (rows as MultiQueueTransaction[]).map(maskShadow);
}

// ─── Master transaction detail (no cashier restriction) ───────────────────────

export type MasterTransactionDetail = TransactionDetail & { cashierId: string };

export async function getMasterTransactionDetail(
  transactionId: string,
): Promise<MasterTransactionDetail | null> {
  const clerkUser = alias(cashierUsers, "clerk_user");
  const updateClerk = alias(cashierUsers, "update_clerk");

  const [row] = await db
    .select({
      id: transactions.id,
      cashierId: transactions.cashierId,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      internalNote: transactions.internalNote,
      deniedReason: transactions.deniedReason,
      methodName: paymentMethods.name,
      methodType: paymentMethods.type,
      playerFirstName: cashierUsers.firstName,
      playerLastName: cashierUsers.lastName,
      playerEmail: cashierUsers.email,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedByClerkUsername: clerkUser.username,
      lockedAt: transactions.lockedAt,
      assignedAt: transactions.assignedAt,
      preconfirmedAt: transactions.preconfirmedAt,
      postconfirmedAt: transactions.postconfirmedAt,
      completedAt: transactions.completedAt,
      deniedAt: transactions.deniedAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(eq(transactions.id, transactionId))
    .limit(1);

  if (!row) return null;

  const [fieldValues, attachments, updatesRaw] = await Promise.all([
    db
      .select({
        id: transactionFieldValues.id,
        fieldLabelSnapshot: transactionFieldValues.fieldLabelSnapshot,
        fieldTypeSnapshot: transactionFieldValues.fieldTypeSnapshot,
        value: transactionFieldValues.value,
      })
      .from(transactionFieldValues)
      .where(eq(transactionFieldValues.transactionId, transactionId)),

    db
      .select({
        id: transactionAttachments.id,
        fileName: transactionAttachments.fileName,
        fileType: transactionAttachments.fileType,
        fileUrl: transactionAttachments.fileUrl,
      })
      .from(transactionAttachments)
      .where(eq(transactionAttachments.transactionId, transactionId)),

    db
      .select({
        id: transactionUpdates.id,
        clerkFirstName: updateClerk.firstName,
        clerkLastName: updateClerk.lastName,
        previousStatus: transactionUpdates.previousStatus,
        newStatus: transactionUpdates.newStatus,
        noteToPlayer: transactionUpdates.noteToPlayer,
        internalNote: transactionUpdates.internalNote,
        createdAt: transactionUpdates.createdAt,
      })
      .from(transactionUpdates)
      .leftJoin(updateClerk, eq(transactionUpdates.updatedByUserId, updateClerk.id))
      .where(eq(transactionUpdates.transactionId, transactionId))
      .orderBy(desc(transactionUpdates.createdAt)),
  ]);

  return { ...row, fieldValues, attachments, updates: updatesRaw };
}

// ─── Cashier clerk list (for assignment UI) ───────────────────────────────────

export type CashierClerk = {
  id: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
};

export async function getCashierClerks(cashierId: string): Promise<CashierClerk[]> {
  const { and, eq } = await import("drizzle-orm");
  return db
    .select({
      id: cashierUsers.id,
      username: cashierUsers.username,
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
    })
    .from(cashierUsers)
    .where(
      and(
        eq(cashierUsers.cashierId, cashierId),
        eq(cashierUsers.role, "clerk"),
        eq(cashierUsers.isActive, true),
      ),
    );
}

// ─── Clerk lookup ──────────────────────────────────────────────────────────────

export async function getClerkById(
  userId: string,
  cashierId: string,
): Promise<{ id: string; firstName: string | null; lastName: string | null; username: string; role: string } | null> {
  const [row] = await db
    .select({
      id: cashierUsers.id,
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
      username: cashierUsers.username,
      role: cashierUsers.role,
    })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}
