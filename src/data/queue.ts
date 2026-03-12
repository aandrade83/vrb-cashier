import { db } from "@/db";
import {
  transactions,
  users,
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
  playerEmail: string;
  lockedByClerkId: string | null;
  lockedByClerkFirstName: string | null;
  lockedByClerkLastName: string | null;
  lockedAt: Date | null;
  lockExpiresAt: Date | null;
  createdAt: Date;
};

export async function getPendingTransactions(): Promise<QueueTransaction[]> {
  const clerkUser = alias(users, "clerk_user");

  const rows = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      methodName: paymentMethods.name,
      playerFirstName: users.firstName,
      playerLastName: users.lastName,
      playerEmail: users.email,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.playerId, users.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(inArray(transactions.status, ["pending", "in_progress"]))
    .orderBy(asc(transactions.createdAt));

  return rows;
}

// ─── Completed transactions ────────────────────────────────────────────────────

export async function getCompletedTransactions(
  type: "deposit" | "payout",
  limit = 10
): Promise<QueueTransaction[]> {
  const clerkUser = alias(users, "clerk_user");

  const rows = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      methodName: paymentMethods.name,
      playerFirstName: users.firstName,
      playerLastName: users.lastName,
      playerEmail: users.email,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.playerId, users.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(
      and(
        inArray(transactions.status, ["approved", "rejected", "completed"]),
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
  playerEmail: string;
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

export async function getTransactionDetail(transactionId: string): Promise<TransactionDetail | null> {
  const clerkUser = alias(users, "clerk_user");
  const updateClerk = alias(users, "update_clerk");

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
      playerFirstName: users.firstName,
      playerLastName: users.lastName,
      playerEmail: users.email,
      lockedByClerkId: transactions.lockedByClerkId,
      lockedByClerkFirstName: clerkUser.firstName,
      lockedByClerkLastName: clerkUser.lastName,
      lockedAt: transactions.lockedAt,
      lockExpiresAt: transactions.lockExpiresAt,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.playerId, users.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .leftJoin(clerkUser, eq(transactions.lockedByClerkId, clerkUser.id))
    .where(eq(transactions.id, transactionId))
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

// ─── Clerk lookup ──────────────────────────────────────────────────────────────

export async function getClerkByClerkId(
  clerkId: string
): Promise<{ id: string; firstName: string | null; lastName: string | null } | null> {
  const [row] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row ?? null;
}
