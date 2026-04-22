"use server";

import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import {
  getReportCsvRows,
  getMasterClerkCashierIds,
  buildCsvString,
  type ReportFilters,
} from "@/data/reports";

export async function exportMasterReportAction(filtersJson: string): Promise<string> {
  const token = await getMasterSessionFromCookies();
  if (!token) throw new Error("Unauthorized");
  const session = await getMasterSessionData(token);
  if (!session) throw new Error("Unauthorized");

  const raw = JSON.parse(filtersJson) as ReportFilters & {
    dateFrom: string;
    dateTo: string;
  };

  // Re-scope cashierIds based on session role
  let allowedCashierIds: string[];
  if (session.role === "master_admin") {
    allowedCashierIds = [];
  } else {
    allowedCashierIds = await getMasterClerkCashierIds(session.masterUserId);
  }

  // If a cashier filter was applied, intersect with allowed
  const requestedIds = raw.cashierIds ?? [];
  const cashierIds =
    allowedCashierIds.length === 0
      ? requestedIds
      : requestedIds.length > 0
      ? requestedIds.filter((id) => allowedCashierIds.includes(id))
      : allowedCashierIds;

  const filters: ReportFilters = {
    ...raw,
    cashierIds,
    dateFrom: new Date(raw.dateFrom),
    dateTo: new Date(raw.dateTo),
  };

  const rows = await getReportCsvRows(filters);
  return buildCsvString(rows);
}
