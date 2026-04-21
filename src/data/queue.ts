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
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  createdAt: Date;
};

export async function getPendingTransactions(cashierId: string): Promise<QueueTransaction[]> {
  const clerkUser = alias(cashierUsers, "clerk_user");

  const rows = await db
    .select({
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
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(
      and(
        eq(transactions.cashierId, cashierId),
        inArray(transactions.status, ["pending", "in_progress", "approved", "post_confirmed"])
      )
    )
    .orderBy(asc(transactions.createdAt));

  return rows;
}

// ─── Completed transactions ────────────────────────────────────────────────────

export async function getCompletedTransactions(
  cashierId: string,
  type: "deposit" | "payout",
  limit = 10
): Promise<QueueTransaction[]> {
  const clerkUser = alias(cashierUsers, "clerk_user");

  const rows = await db
    .select({
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
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(
      and(
        eq(transactions.cashierId, cashierId),
        inArray(transactions.status, ["completed", "rejected"]),
        eq(transactions.type, type)
      )
    )
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  return rows;
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
  methodName: string;
  methodType: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  playerEmail: string | null;
  lockedByClerkId: string | null;
  lockedByClerkFirstName: string | null;
  lockedByClerkLastName: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
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
  cashierId: string
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
      methodName: paymentMethods.name,
      methodType: paymentMethods.type,
      playerFirstName: cashierUsers.firstName,
      playerLastName: cashierUsers.lastName,
      playerEmail: cashierUsers.email,
      playerUsername: cashierUsers.username,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(and(eq(transactions.id, transactionId), eq(transactions.cashierId, cashierId)))
    .limit(1);

  if (!row) return null;

  const fieldValues = await db
    .select({
      id: transactionFieldValues.id,
      fieldLabelSnapshot: transactionFieldValues.fieldLabelSnapshot,
      fieldTypeSnapshot: transactionFieldValues.fieldTypeSnapshot,
      value: transactionFieldValues.value,
    })
    .from(transactionFieldValues)
    .where(eq(transactionFieldValues.transactionId, transactionId));

  const attachments = await db
    .select({
      id: transactionAttachments.id,
      fileName: transactionAttachments.fileName,
      fileType: transactionAttachments.fileType,
      fileUrl: transactionAttachments.fileUrl,
    })
    .from(transactionAttachments)
    .where(eq(transactionAttachments.transactionId, transactionId));

  const updatesRaw = await db
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
    .orderBy(desc(transactionUpdates.createdAt));

  return { ...row, fieldValues, attachments, updates: updatesRaw };
}

// ─── Multi-cashier queue (for master clerk dashboard) ─────────────────────────

export type MultiQueueTransaction = QueueTransaction & {
  cashierId: string;
  cashierName: string;
  cashierSlug: string;
  cashierToken: string;
};

export async function getPendingTransactionsMulti(
  cashierIds: string[],
): Promise<MultiQueueTransaction[]> {
  if (cashierIds.length === 0) return [];
  const clerkUser = alias(cashierUsers, "clerk_user");

  const rows = await db
    .select({
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
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
      cashierId: transactions.cashierId,
      cashierName: cashiers.name,
      cashierSlug: cashiers.slug,
      cashierToken: cashiers.token,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(
      and(
        inArray(transactions.cashierId, cashierIds),
        inArray(transactions.status, ["pending", "in_progress", "approved", "post_confirmed"]),
      ),
    )
    .orderBy(asc(transactions.createdAt));

  return rows as MultiQueueTransaction[];
}

export async function getCompletedTransactionsMulti(
  cashierIds: string[],
  limit = 20,
): Promise<MultiQueueTransaction[]> {
  if (cashierIds.length === 0) return [];
  const clerkUser = alias(cashierUsers, "clerk_user");

  const rows = await db
    .select({
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
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
      cashierId: transactions.cashierId,
      cashierName: cashiers.name,
      cashierSlug: cashiers.slug,
      cashierToken: cashiers.token,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(
      and(
        inArray(transactions.cashierId, cashierIds),
        inArray(transactions.status, ["completed", "rejected"]),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  return rows as MultiQueueTransaction[];
}

// ─── Clerk lookup ──────────────────────────────────────────────────────────────

export async function getClerkById(
  userId: string,
  cashierId: string
): Promise<{ id: string; firstName: string | null; lastName: string | null } | null> {
  const [row] = await db
    .select({ id: cashierUsers.id, firstName: cashierUsers.firstName, lastName: cashierUsers.lastName })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}
