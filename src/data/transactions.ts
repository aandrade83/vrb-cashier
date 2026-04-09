import { db } from "@/db";
import { transactions, users, paymentMethods } from "@/db/schema";
import { eq, count, desc, and } from "drizzle-orm";

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
  const player = users;
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

export async function getPlayerByClerkId(
  clerkId: string,
  cashierId: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.clerkId, clerkId), eq(users.cashierId, cashierId)))
    .limit(1);
  return row ?? null;
}
