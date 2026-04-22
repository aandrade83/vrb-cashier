import { db } from "@/db";
import {
  transactions,
  cashierUsers,
  cashiers,
  paymentMethods,
  transactionUpdates,
  userCashierPermissions,
} from "@/db/schema";
import {
  eq,
  and,
  or,
  inArray,
  gte,
  lte,
  ilike,
  count,
  desc,
  asc,
  sql,
  type SQL,
} from "drizzle-orm";

// =============================================================================
// Types
// =============================================================================

export type ReportFilters = {
  cashierIds: string[];     // empty = all (master sees all)
  dateFrom: Date;
  dateTo: Date;
  status?: string;
  methodId?: string;
  clerkId?: string;         // filter by a specific assigned clerk
  playerSearch?: string;
  type?: "deposit" | "payout";
  clerkOwnOnly?: boolean;   // clerk role: only show their handled transactions
  ownClerkId?: string;      // the acting clerk's cashier_user ID
};

export type ReportMetrics = {
  totalTransactions: number;
  totalCompletedAmount: string;
  totalDeniedCount: number;
  avgCompletionMinutes: number | null;
  pendingNow: number;
  unassignedNow: number;
  avgUnassignedToPendingMinutes: number | null;
  avgPendingToCompletedMinutes: number | null;
  bestClerkName: string | null;
  bestClerkVolume: number;
  slowestPendingAgeMinutes: number | null;
};

export type ReportRow = {
  id: string;
  referenceCode: string;
  cashierName: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  methodName: string;
  playerUsername: string | null;
  playerEmail: string | null;
  assignedClerkName: string | null;
  createdAt: Date;
  completedAt: Date | null;
  deniedAt: Date | null;
  totalMinutes: number | null;
  deniedReason: string | null;
};

export type ReportPage = {
  rows: ReportRow[];
  total: number;
};

export type ReportFilterOptions = {
  cashiers: { id: string; name: string }[];
  methods: { id: string; name: string; type: string }[];
  clerks: { id: string; name: string }[];
};

// =============================================================================
// WHERE clause builder
// Joins assumed: transactions + cashiers + cashierUsers (player) + paymentMethods
// =============================================================================

function buildWhere(f: ReportFilters): SQL | undefined {
  const conds: (SQL | undefined)[] = [];

  if (f.cashierIds.length > 0) {
    conds.push(inArray(transactions.cashierId, f.cashierIds));
  }

  conds.push(gte(transactions.createdAt, f.dateFrom));
  conds.push(lte(transactions.createdAt, f.dateTo));

  if (f.status) {
    conds.push(eq(transactions.status, f.status as never));
  }

  if (f.methodId) {
    conds.push(eq(transactions.methodId, f.methodId));
  }

  if (f.type) {
    conds.push(eq(transactions.type, f.type));
  }

  const effectiveClerkId = f.clerkOwnOnly ? f.ownClerkId : f.clerkId;
  if (effectiveClerkId) {
    conds.push(
      sql`EXISTS (
        SELECT 1 FROM transaction_updates _tu
        WHERE _tu.transaction_id = ${transactions.id}
        AND _tu.updated_by_user_id = ${effectiveClerkId}::uuid
      )`,
    );
  }

  if (f.playerSearch) {
    const q = `%${f.playerSearch}%`;
    conds.push(
      or(
        ilike(cashierUsers.username, q),
        ilike(cashierUsers.email, q),
      ),
    );
  }

  const valid = conds.filter(Boolean) as SQL[];
  return valid.length > 0 ? and(...valid) : undefined;
}

// WHERE for the "live now" counts — cashier scope only, no date/status filters
function buildLiveWhere(cashierIds: string[]): SQL | undefined {
  if (cashierIds.length === 0) return undefined;
  return inArray(transactions.cashierId, cashierIds);
}

// =============================================================================
// Metrics
// =============================================================================

export async function getReportMetrics(f: ReportFilters): Promise<ReportMetrics> {
  const whereClause = buildWhere(f);
  const liveWhere = buildLiveWhere(f.cashierIds);

  const baseQ = db
    .select({
      totalTransactions: count(transactions.id),
      totalDeniedCount: sql<number>`COUNT(${transactions.id}) FILTER (WHERE ${transactions.status} = 'denied')`,
      totalCompletedAmount: sql<string>`COALESCE(SUM(${transactions.amount}::numeric) FILTER (WHERE ${transactions.status} = 'completed'), 0)::text`,
      avgCompletionMinutes: sql<number | null>`
        ROUND(AVG(
          EXTRACT(EPOCH FROM (${transactions.completedAt} - ${transactions.assignedAt})) / 60
        ) FILTER (WHERE ${transactions.completedAt} IS NOT NULL AND ${transactions.assignedAt} IS NOT NULL))::int
      `,
      avgUnassignedToPendingMinutes: sql<number | null>`
        ROUND(AVG(
          EXTRACT(EPOCH FROM (${transactions.assignedAt} - ${transactions.createdAt})) / 60
        ) FILTER (WHERE ${transactions.assignedAt} IS NOT NULL))::int
      `,
      avgPendingToCompletedMinutes: sql<number | null>`
        ROUND(AVG(
          EXTRACT(EPOCH FROM (${transactions.completedAt} - ${transactions.assignedAt})) / 60
        ) FILTER (WHERE ${transactions.completedAt} IS NOT NULL AND ${transactions.assignedAt} IS NOT NULL))::int
      `,
      slowestPendingAgeMinutes: sql<number | null>`
        ROUND(MAX(
          EXTRACT(EPOCH FROM (NOW() - ${transactions.createdAt})) / 60
        ) FILTER (WHERE ${transactions.status} = 'pending'))::int
      `,
    })
    .from(transactions)
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .where(whereClause);

  const liveQ = db
    .select({
      pendingNow: sql<number>`COUNT(${transactions.id}) FILTER (WHERE ${transactions.status} = 'pending')`,
      unassignedNow: sql<number>`COUNT(${transactions.id}) FILTER (WHERE ${transactions.status} = 'unassigned')`,
    })
    .from(transactions)
    .where(liveWhere);

  // Best clerk: most completed transactions in date/cashier scope
  const bestClerkConds: (SQL | undefined)[] = [];
  if (f.cashierIds.length > 0) {
    bestClerkConds.push(inArray(transactions.cashierId, f.cashierIds));
  }
  bestClerkConds.push(gte(transactions.createdAt, f.dateFrom));
  bestClerkConds.push(lte(transactions.createdAt, f.dateTo));

  const bestClerkQ = db
    .select({
      firstName: cashierUsers.firstName,
      lastName: cashierUsers.lastName,
      username: cashierUsers.username,
      volume: sql<number>`COUNT(DISTINCT ${transactionUpdates.transactionId})`,
    })
    .from(transactionUpdates)
    .innerJoin(cashierUsers, eq(transactionUpdates.updatedByUserId, cashierUsers.id))
    .innerJoin(transactions, eq(transactionUpdates.transactionId, transactions.id))
    .where(
      and(
        eq(transactionUpdates.newStatus, "completed"),
        ...(bestClerkConds.filter(Boolean) as SQL[]),
      ),
    )
    .groupBy(
      transactionUpdates.updatedByUserId,
      cashierUsers.firstName,
      cashierUsers.lastName,
      cashierUsers.username,
    )
    .orderBy(desc(sql`COUNT(DISTINCT ${transactionUpdates.transactionId})`))
    .limit(1);

  const [[main], [live], bestClerks] = await Promise.all([baseQ, liveQ, bestClerkQ]);

  const best = bestClerks[0] ?? null;
  const bestClerkName = best
    ? ([best.firstName, best.lastName].filter(Boolean).join(" ") || best.username)
    : null;

  return {
    totalTransactions: Number(main?.totalTransactions ?? 0),
    totalCompletedAmount: main?.totalCompletedAmount ?? "0",
    totalDeniedCount: Number(main?.totalDeniedCount ?? 0),
    avgCompletionMinutes: main?.avgCompletionMinutes ?? null,
    pendingNow: Number(live?.pendingNow ?? 0),
    unassignedNow: Number(live?.unassignedNow ?? 0),
    avgUnassignedToPendingMinutes: main?.avgUnassignedToPendingMinutes ?? null,
    avgPendingToCompletedMinutes: main?.avgPendingToCompletedMinutes ?? null,
    bestClerkName,
    bestClerkVolume: best ? Number(best.volume) : 0,
    slowestPendingAgeMinutes: main?.slowestPendingAgeMinutes ?? null,
  };
}

// =============================================================================
// Rows (paginated)
// =============================================================================

const SORTABLE_COLUMNS: Record<string, SQL> = {
  createdAt: transactions.createdAt as unknown as SQL,
  referenceCode: transactions.referenceCode as unknown as SQL,
  amount: sql`${transactions.amount}::numeric`,
  status: transactions.status as unknown as SQL,
  type: transactions.type as unknown as SQL,
  completedAt: transactions.completedAt as unknown as SQL,
  totalMinutes: sql`EXTRACT(EPOCH FROM (${transactions.completedAt} - ${transactions.assignedAt}))`,
};

function buildOrderBy(sortBy: string, sortDir: "asc" | "desc"): SQL {
  const col = SORTABLE_COLUMNS[sortBy] ?? SORTABLE_COLUMNS.createdAt;
  return sortDir === "asc" ? asc(col) : desc(col);
}

function rowSelect() {
  return {
    id: transactions.id,
    referenceCode: transactions.referenceCode,
    cashierName: cashiers.name,
    type: transactions.type,
    status: transactions.status,
    amount: transactions.amount,
    currency: transactions.currency,
    methodName: paymentMethods.name,
    playerUsername: cashierUsers.username,
    playerEmail: cashierUsers.email,
    createdAt: transactions.createdAt,
    completedAt: transactions.completedAt,
    deniedAt: transactions.deniedAt,
    deniedReason: transactions.deniedReason,
    totalMinutes: sql<number | null>`
      CASE WHEN ${transactions.completedAt} IS NOT NULL AND ${transactions.assignedAt} IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (${transactions.completedAt} - ${transactions.assignedAt})) / 60)::int
      ELSE NULL END
    `,
    assignedClerkName: sql<string | null>`(
      SELECT COALESCE(
        NULLIF(TRIM(COALESCE(cu.first_name, '') || ' ' || COALESCE(cu.last_name, '')), ''),
        cu.username
      )
      FROM transaction_updates _tu2
      INNER JOIN cashier_users cu ON cu.id = _tu2.updated_by_user_id
      WHERE _tu2.transaction_id = ${transactions.id}
      ORDER BY _tu2.created_at ASC
      LIMIT 1
    )`,
  };
}

export async function getReportRows(
  f: ReportFilters,
  page: number,
  pageSize: number,
  sortBy: string,
  sortDir: "asc" | "desc",
): Promise<ReportPage> {
  const whereClause = buildWhere(f);
  const orderBy = buildOrderBy(sortBy, sortDir);
  const offset = (page - 1) * pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(rowSelect())
      .from(transactions)
      .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
      .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
      .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset),

    db
      .select({ total: count(transactions.id) })
      .from(transactions)
      .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
      .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
      .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
      .where(whereClause),
  ]);

  return { rows: rows as ReportRow[], total: Number(total ?? 0) };
}

// All rows without pagination — for CSV export
export async function getReportCsvRows(f: ReportFilters): Promise<ReportRow[]> {
  const whereClause = buildWhere(f);
  const rows = await db
    .select(rowSelect())
    .from(transactions)
    .innerJoin(cashiers, eq(transactions.cashierId, cashiers.id))
    .innerJoin(cashierUsers, eq(transactions.playerId, cashierUsers.id))
    .innerJoin(paymentMethods, eq(transactions.methodId, paymentMethods.id))
    .where(whereClause)
    .orderBy(desc(transactions.createdAt));

  return rows as ReportRow[];
}

// =============================================================================
// Filter option lists
// =============================================================================

export async function getReportFilterOptions(cashierIds: string[]): Promise<ReportFilterOptions> {
  const cashierWhere =
    cashierIds.length > 0 ? inArray(transactions.cashierId, cashierIds) : undefined;

  const [cashierRows, methodRows, clerkRows] = await Promise.all([
    // All accessible cashiers
    cashierIds.length > 0
      ? db
          .select({ id: cashiers.id, name: cashiers.name })
          .from(cashiers)
          .where(inArray(cashiers.id, cashierIds))
          .orderBy(asc(cashiers.name))
      : db.select({ id: cashiers.id, name: cashiers.name }).from(cashiers).orderBy(asc(cashiers.name)),

    // Methods actually used in transactions in scope
    db
      .selectDistinct({ id: paymentMethods.id, name: paymentMethods.name, type: paymentMethods.type })
      .from(paymentMethods)
      .innerJoin(transactions, eq(transactions.methodId, paymentMethods.id))
      .where(cashierWhere)
      .orderBy(asc(paymentMethods.name)),

    // Clerks (non-shadow) with transactions in scope
    db
      .selectDistinct({
        id: cashierUsers.id,
        firstName: cashierUsers.firstName,
        lastName: cashierUsers.lastName,
        username: cashierUsers.username,
      })
      .from(cashierUsers)
      .innerJoin(
        transactionUpdates,
        eq(transactionUpdates.updatedByUserId, cashierUsers.id),
      )
      .innerJoin(transactions, eq(transactionUpdates.transactionId, transactions.id))
      .where(
        and(
          eq(cashierUsers.role, "clerk"),
          cashierWhere,
        ),
      )
      .orderBy(asc(cashierUsers.username)),
  ]);

  return {
    cashiers: cashierRows,
    methods: methodRows,
    clerks: clerkRows.map((c) => ({
      id: c.id,
      name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.username,
    })),
  };
}

// =============================================================================
// Auth helpers
// =============================================================================

// Returns the cashier IDs a master_clerk user has explicit permission for.
// Returns [] if masterUserId is null (ENV root — has access to everything,
// caller should treat [] as "no restriction").
export async function getMasterClerkCashierIds(
  masterUserId: string | null,
): Promise<string[]> {
  if (!masterUserId) return []; // ENV root: no restriction needed
  const rows = await db
    .select({ cashierId: userCashierPermissions.cashierId })
    .from(userCashierPermissions)
    .where(eq(userCashierPermissions.masterUserId, masterUserId));
  return rows.map((r) => r.cashierId);
}

// =============================================================================
// CSV builder (used by export actions)
// =============================================================================

export function buildCsvString(rows: ReportRow[]): string {
  const headers = [
    "Date",
    "Ref Code",
    "Username",
    "Cashier",
    "Type",
    "Method",
    "Amount",
    "Currency",
    "Status",
    "Assigned Clerk",
    "Created At",
    "Completed At",
    "Total Minutes",
    "Denied Reason",
  ];

  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        escape(r.createdAt.toISOString().split("T")[0]),
        escape(r.referenceCode),
        escape(r.playerUsername),
        escape(r.cashierName),
        escape(r.type),
        escape(r.methodName),
        escape(r.amount),
        escape(r.currency),
        escape(r.status),
        escape(r.assignedClerkName),
        escape(r.createdAt.toISOString()),
        escape(r.completedAt?.toISOString() ?? null),
        escape(r.totalMinutes != null ? String(r.totalMinutes) : null),
        escape(r.deniedReason),
      ].join(","),
    ),
  ];

  return lines.join("\n");
}
