import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import {
  getReportMetrics,
  getReportRows,
  getReportFilterOptions,
  type ReportFilters,
} from "@/data/reports";
import { FilterBar } from "@/components/reports/FilterBar";
import { MetricCards } from "@/components/reports/MetricCards";
import { ReportTable } from "@/components/reports/ReportTable";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { exportAdminReportAction } from "./actions";

const PAGE_SIZE = 50;

function defaultFrom() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split("T")[0];
}

function defaultTo() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 0);
  return d.toISOString().split("T")[0];
}

export default async function AdminReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug, token } = await params;
  const access = await getCashierPageAccess("admin");
  if (!access) redirect(`/${slug}/${token}/sign-in`);

  const { cashierId } = access;
  const sp = await searchParams;

  const fromStr = sp.from ?? defaultFrom();
  const toStr = sp.to ?? defaultTo();
  const dateFrom = new Date(`${fromStr}T00:00:00`);
  const dateTo = new Date(`${toStr}T23:59:59`);

  const filters: ReportFilters = {
    cashierIds: [cashierId],
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
    getReportFilterOptions([cashierId]),
  ]);

  const filtersJson = JSON.stringify({
    ...filters,
    cashierIds: [cashierId],
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {fromStr} → {toStr}
          </p>
        </div>
        <ExportButtons
          exportAction={exportAdminReportAction}
          filtersJson={filtersJson}
          filename="cashier-report"
        />
      </div>

      <Suspense>
        <FilterBar
          methods={filterOptions.methods}
          clerks={filterOptions.clerks}
          showCashierFilter={false}
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
              showCashierColumn={false}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
