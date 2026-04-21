// Admin transaction queries — scoped to a cashier.
// Covers deposits and payouts with status-based filtering.
// Default filter: today.

import { db } from "@/db";
import { transactions, cashierUsers, paymentMethods } from "@/db/schema";
import { eq, and, inArray, gte, lte, desc, ilike } from "drizzle-orm";
import { TX_STATUS_LABEL, TX_STATUS_BADGE_VARIANT, type TxStatus } from "@/lib/transaction-statuses";

export type AdminTransaction = {
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
  createdAt: Date;
};

export type TransactionStatusFilter = TxStatus;

function todayRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from, to };
}

export async function getAdminTransactions({
  cashierId,
  type,
  statuses,
  from,
  to,
  search,
}: {
  cashierId: string;
  type: "deposit" | "payout";
  statuses: TransactionStatusFilter[];
  from?: Date;
  to?: Date;
  search?: string;
}): Promise<AdminTransaction[]> {
  const range = from && to ? { from, to } : todayRange();

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
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .where(and(
      eq(transactions.cashierId, cashierId),
      eq(transactions.type, type),
      inArray(transactions.status, statuses),
      gte(transactions.createdAt, range.from),
      lte(transactions.createdAt, range.to),
    ))
    .orderBy(desc(transactions.createdAt));

  if (!search) return rows;

  const q = search.toLowerCase();
  return rows.filter(
    (r) =>
      r.referenceCode.toLowerCase().includes(q) ||
      (r.playerEmail ?? "").toLowerCase().includes(q) ||
      (r.playerFirstName ?? "").toLowerCase().includes(q) ||
      (r.playerLastName ?? "").toLowerCase().includes(q),
  );
}

// Re-export from centralized constants so existing consumers don't break
export const STATUS_LABELS: Record<string, string> = TX_STATUS_LABEL;
export const STATUS_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = TX_STATUS_BADGE_VARIANT;
