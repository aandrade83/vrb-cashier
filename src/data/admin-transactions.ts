// =============================================================================
// Admin transaction queries — scoped to a cashier.
// Covers deposits and payouts with status-based filtering.
// Default filter: today.
// =============================================================================

import { db } from "@/db";
import { transactions, users, paymentMethods } from "@/db/schema";
import { eq, and, inArray, gte, lte, desc, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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
  playerEmail: string;
  createdAt: Date;
};

export type TransactionStatusFilter =
  | "pending"        // pre_confirmed
  | "in_progress"
  | "approved"       // post_confirmed
  | "rejected"       // denied
  | "completed"
  | "cancelled";

function todayRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
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
  // Default to today if no date range provided
  const range = from && to ? { from, to } : todayRange();

  const conditions = [
    eq(transactions.cashierId, cashierId),
    eq(transactions.type, type),
    inArray(transactions.status, statuses),
    gte(transactions.createdAt, range.from),
    lte(transactions.createdAt, range.to),
  ];

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
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .innerJoin(users, eq(transactions.playerId, users.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt));

  if (search) {
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.referenceCode.toLowerCase().includes(q) ||
        r.playerEmail.toLowerCase().includes(q) ||
        (r.playerFirstName ?? "").toLowerCase().includes(q) ||
        (r.playerLastName ?? "").toLowerCase().includes(q)
    );
  }

  return rows;
}

// Status label mapping for UI display
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pre-confirmed",
  in_progress: "In Progress",
  approved: "Post-confirmed",
  rejected: "Denied",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  in_progress: "secondary",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "secondary",
};
