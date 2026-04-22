"use server";

import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getCashierId } from "@/lib/cashier-context";
import { getMasterSession } from "@/lib/auth/session";
import { getOrCreateCashierActor } from "@/lib/master-actor";
import { getReportCsvRows, buildCsvString, type ReportFilters } from "@/data/reports";

export async function exportClerkReportAction(filtersJson: string): Promise<string> {
  const cashierId = await getCashierId();
  const access = await getCashierPageAccess("clerk");
  if (!access || access.cashierId !== cashierId) throw new Error("Unauthorized");

  // Detect master_admin — they see all transactions
  let isMasterAdmin = false;
  let ownClerkId: string | undefined;
  if (access.isMasterActing) {
    const masterSession = await getMasterSession();
    isMasterAdmin = masterSession?.role === "master_admin";
    if (!isMasterAdmin) {
      const actor = await getOrCreateCashierActor(cashierId);
      ownClerkId = actor?.id;
    }
  } else {
    ownClerkId = access.userId ?? undefined;
  }

  const raw = JSON.parse(filtersJson) as ReportFilters & {
    dateFrom: string;
    dateTo: string;
  };

  const filters: ReportFilters = {
    ...raw,
    cashierIds: [cashierId],
    dateFrom: new Date(raw.dateFrom),
    dateTo: new Date(raw.dateTo),
    clerkOwnOnly: !isMasterAdmin,
    ownClerkId: isMasterAdmin ? undefined : ownClerkId,
  };

  const rows = await getReportCsvRows(filters);
  return buildCsvString(rows);
}
