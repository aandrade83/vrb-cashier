"use server";

import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getCashierId } from "@/lib/cashier-context";
import { getReportCsvRows, buildCsvString, type ReportFilters } from "@/data/reports";

export async function exportAdminReportAction(filtersJson: string): Promise<string> {
  const cashierId = await getCashierId();
  const access = await getCashierPageAccess("admin");
  if (!access || access.cashierId !== cashierId) throw new Error("Unauthorized");

  const raw = JSON.parse(filtersJson) as ReportFilters & {
    dateFrom: string;
    dateTo: string;
  };

  const filters: ReportFilters = {
    ...raw,
    cashierIds: [cashierId], // enforce scope regardless of what was sent
    dateFrom: new Date(raw.dateFrom),
    dateTo: new Date(raw.dateTo),
  };

  const rows = await getReportCsvRows(filters);
  return buildCsvString(rows);
}
