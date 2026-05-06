import { db } from "@/db";
import { transactions, cashierUsers, paymentMethods, transactionUpdates } from "@/db/schema";
import { eq, count, desc, and, isNotNull } from "drizzle-orm";

export type PlayerTransaction = {
  id: string;
  referenceCode: string;
  type: "deposit" | "payout";
  status: string;
  amount: string;
  currency: string;
  methodName: string;
  playerFirstName: string | null;
  playerLastName: string | null;
  createdAt: Date;
};

export async function getPlayerTransactions(
  playerDbId: string,
  cashierId: string
): Promise<PlayerTransaction[]> {
  const player = cashierUsers;
  const rows = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      methodName: paymentMethods.name,
      playerFirstName: player.firstName,
      playerLastName: player.lastName,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .innerJoin(player, eq(transactions.playerId, player.id))
    .where(
      and(
        eq(transactions.playerId, playerDbId),
        eq(transactions.cashierId, cashierId)
      )
    )
    .orderBy(desc(transactions.createdAt));

  return rows;
}

export async function findTransactionByIdempotencyKey(key: string, cashierId: string) {
  const [row] = await db
    .select({ id: transactions.id, referenceCode: transactions.referenceCode })
    .from(transactions)
    .where(and(eq(transactions.idempotencyKey, key), eq(transactions.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}

export async function getNextTransactionSequence(
  type: "deposit" | "payout",
  cashierId: string
): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(transactions)
    .where(and(eq(transactions.type, type), eq(transactions.cashierId, cashierId)));
  return (result?.total ?? 0) + 1;
}

export type PlayerTransactionDetail = {
  id: string;
  referenceCode: string;
  type: "deposit" | "payout";
  status: string;
  amount: string;
  currency: string;
  methodName: string;
  internalNote: string | null;
  deniedReason: string | null;
  createdAt: Date;
  notesToPlayer: {
    id: string;
    noteToPlayer: string;
    createdAt: Date;
  }[];
};

export async function getPlayerTransactionDetail(
  transactionId: string,
  playerId: string,
  cashierId: string,
): Promise<PlayerTransactionDetail | null> {
  const [row] = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      status: transactions.status,
      amount: transactions.amount,
      currency: transactions.currency,
      methodName: paymentMethods.name,
      internalNote: transactions.internalNote,
      deniedReason: transactions.deniedReason,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.playerId, playerId),
        eq(transactions.cashierId, cashierId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const notesToPlayer = await db
    .select({
      id: transactionUpdates.id,
      noteToPlayer: transactionUpdates.noteToPlayer,
      createdAt: transactionUpdates.createdAt,
    })
    .from(transactionUpdates)
    .where(
      and(
        eq(transactionUpdates.transactionId, transactionId),
        isNotNull(transactionUpdates.noteToPlayer),
      ),
    )
    .orderBy(desc(transactionUpdates.createdAt));

  return {
    ...row,
    notesToPlayer: notesToPlayer.filter((n) => n.noteToPlayer !== null) as PlayerTransactionDetail["notesToPlayer"],
  };
}

export async function updatePlayerTransactionNote(
  transactionId: string,
  playerId: string,
  cashierId: string,
  note: string,
): Promise<void> {
  await db
    .update(transactions)
    .set({ internalNote: note || null })
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.playerId, playerId),
        eq(transactions.cashierId, cashierId),
      ),
    );
}

export async function getPlayerById(
  userId: string,
  cashierId: string,
): Promise<{ id: string; username: string; email: string | null; firstName: string | null; lastName: string | null } | null> {
  const [row] = await db
    .select({
      id: cashierUsers.id,
      username: cashierUsers.username,
      email: cashierUsers.email,
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
    })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}
