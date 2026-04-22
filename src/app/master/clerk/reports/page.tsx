export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { MasterClerkNav } from "@/components/master-clerk-nav";
import {
  getReportMetrics,
  getReportRows,
  getReportFilterOptions,
  getMasterClerkCashierIds,
  type ReportFilters,
} from "@/data/reports";
import { FilterBar } from "@/components/reports/FilterBar";
import { MetricCards } from "@/components/reports/MetricCards";
import { ReportTable } from "@/components/reports/ReportTable";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { exportMasterReportAction } from "./actions";

const PAGE_SIZE = 50;

function defaultDateFrom(): string {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function defaultDateTo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().split("T")[0];
}

export default async function MasterReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");
  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  const sp = await searchParams;

  // Determine cashier scope
  let scopedCashierIds: string[];
  if (session.role === "master_admin") {
    scopedCashierIds = []; // all cashiers
  } else {
    scopedCashierIds = await getMasterClerkCashierIds(session.masterUserId);
  }

  // Parse filters from URL
  const fromStr = sp.from ?? defaultDateFrom();
  const toStr = sp.to ?? defaultDateTo();
  const dateFrom = new Date(`${fromStr}T00:00:00`);
  const dateTo = new Date(`${toStr}T23:59:59`);

  // If a specific cashier was selected, intersect with allowed scope
  const selectedCashier = sp.cashier;
  const cashierIds =
    selectedCashier && (scopedCashierIds.length === 0 || scopedCashierIds.includes(selectedCashier))
      ? [selectedCashier]
      : scopedCashierIds;

  const filters: ReportFilters = {
    cashierIds,
    dateFrom,
    dateTo,
    status: sp.status,
    methodId: sp.method,
    clerkId: sp.clerk,
    playerSearch: sp.q,
    type: sp.type as "deposit" | "payout" | undefined,
  };

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const sortBy = sp.sort ?? "createdAt";
  const sortDir = (sp.dir ?? "desc") as "asc" | "desc";

  const [metrics, { rows, total }, filterOptions] = await Promise.all([
    getReportMetrics(filters),
    getReportRows(filters, page, PAGE_SIZE, sortBy, sortDir),
    getReportFilterOptions(scopedCashierIds),
  ]);

  const filtersJson = JSON.stringify({
    ...filters,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="reports" />
      <main className="flex-1 p-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Reports</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {session.role === "master_admin" ? "All cashiers" : "Your accessible cashiers"}
                {" · "}
                {fromStr} → {toStr}
              </p>
            </div>
            <ExportButtons
              exportAction={exportMasterReportAction}
              filtersJson={filtersJson}
              filename="master-report"
            />
          </div>

          <Suspense>
            <FilterBar
              cashiers={filterOptions.cashiers}
              methods={filterOptions.methods}
              clerks={filterOptions.clerks}
              showCashierFilter={true}
            />
          </Suspense>

          <MetricCards metrics={metrics} />

          <div className="rounded-lg border bg-card p-1">
            <div className="px-3 py-2 border-b">
              <span className="text-sm font-medium">Transactions</span>
              <span className="text-xs text-muted-foreground ml-2">({total.toLocaleString()} total)</span>
            </div>
            <div className="p-3">
              <Suspense>
                <ReportTable
                  rows={rows}
                  total={total}
                  page={page}
                  pageSize={PAGE_SIZE}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  showCashierColumn={true}
                />
              </Suspense>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
