import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, count } from "drizzle-orm";

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
