"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TX_STATUS_LABEL, TX_STATUS_BADGE_VARIANT } from "@/lib/transaction-statuses";
import type { ReportRow } from "@/data/reports";

interface Props {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  showCashierColumn: boolean;
}

type Col = {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
};

const COLS: Col[] = [
  { key: "createdAt", label: "Date", sortable: true },
  { key: "referenceCode", label: "Ref Code", sortable: true },
  { key: "playerUsername", label: "Username" },
  { key: "cashierName", label: "Cashier" },
  { key: "type", label: "Type", sortable: true },
  { key: "methodName", label: "Method" },
  { key: "amount", label: "Amount", sortable: true, className: "text-right" },
  { key: "status", label: "Status", sortable: true },
  { key: "assignedClerkName", label: "Assigned Clerk" },
  { key: "completedAt", label: "Completed At", sortable: true },
  { key: "totalMinutes", label: "Minutes", sortable: true, className: "text-right" },
  { key: "deniedReason", label: "Denied Reason" },
];

export function ReportTable({
  rows,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  showCashierColumn,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null) {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  function handleSort(col: string) {
    if (sortBy === col) {
      setParam({ sort: col, dir: sortDir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      setParam({ sort: col, dir: "desc", page: "1" });
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const visibleCols = showCashierColumn
    ? COLS
    : COLS.filter((c) => c.key !== "cashierName");

  return (
    <div className="space-y-3">
      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {visibleCols.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`text-xs whitespace-nowrap ${col.className ?? ""}`}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors font-medium"
                      >
                        {col.label}
                        {sortBy === col.key ? (
                          <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>
                        ) : (
                          <span className="text-muted-foreground/40">↕</span>
                        )}
                      </button>
                    ) : (
                      col.label
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleCols.length}
                    className="text-center text-muted-foreground py-12 text-sm"
                  >
                    No transactions found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(row.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {row.referenceCode}
                    </TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {row.playerUsername ?? row.playerEmail ?? "—"}
                    </TableCell>
                    {showCashierColumn && (
                      <TableCell className="text-sm whitespace-nowrap">{row.cashierName}</TableCell>
                    )}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.type === "deposit"
                            ? "border-green-500 text-green-700 text-xs"
                            : "border-orange-500 text-orange-700 text-xs"
                        }
                      >
                        {row.type === "deposit" ? "Deposit" : "Payout"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{row.methodName}</TableCell>
                    <TableCell className="text-sm font-medium text-right whitespace-nowrap">
                      {parseFloat(row.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-muted-foreground text-xs">{row.currency}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          TX_STATUS_BADGE_VARIANT[row.status as keyof typeof TX_STATUS_BADGE_VARIANT] ??
                          "secondary"
                        }
                        className="text-xs capitalize"
                      >
                        {TX_STATUS_LABEL[row.status as keyof typeof TX_STATUS_LABEL] ?? row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.assignedClerkName ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.completedAt ? format(row.completedAt, "do MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-right">
                      {row.totalMinutes != null ? `${row.totalMinutes}m` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {row.deniedReason ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {total === 0
            ? "No results"
            : `${((page - 1) * pageSize + 1).toLocaleString()}–${Math.min(page * pageSize, total).toLocaleString()} of ${total.toLocaleString()}`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setParam({ page: String(page - 1) })}
          >
            ← Prev
          </Button>
          <span className="text-muted-foreground text-xs">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setParam({ page: String(page + 1) })}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
