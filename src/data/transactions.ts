import { db } from "@/db";
import { transactions, users, paymentMethods } from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";

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

export async function getPlayerTransactions(playerDbId: string): Promise<PlayerTransaction[]> {
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
    .where(eq(transactions.playerId, playerDbId))
    .orderBy(desc(transactions.createdAt));

  return rows;
}

export async function findTransactionByIdempotencyKey(key: string) {
  const [row] = await db
    .select({ id: transactions.id, referenceCode: transactions.referenceCode })
    .from(transactions)
    .where(eq(transactions.idempotencyKey, key))
    .limit(1);
  return row ?? null;
}

export async function getNextTransactionSequence(type: "deposit" | "payout"): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(transactions)
    .where(eq(transactions.type, type));
  return (result?.total ?? 0) + 1;
}

export async function getPlayerByClerkId(clerkId: string): Promise<{ id: string } | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return row ?? null;
}
