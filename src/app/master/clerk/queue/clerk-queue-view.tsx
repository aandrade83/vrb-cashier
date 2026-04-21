"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MultiQueueTransaction } from "@/data/queue";
import type { Cashier } from "@/db/schema";
import { TX_STATUS_LABEL, TX_STATUS_BADGE_VARIANT } from "@/lib/transaction-statuses";

interface Props {
  pending: MultiQueueTransaction[];
  completed: MultiQueueTransaction[];
  cashiers: Pick<Cashier, "id" | "name">[];
}

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className={
        type === "deposit"
          ? "border-green-500 text-green-700"
          : "border-orange-500 text-orange-700"
      }
    >
      {type === "deposit" ? "Deposit" : "Payout"}
    </Badge>
  );
}

export function ClerkQueueView({ pending, completed, cashiers }: Props) {
  const router = useRouter();
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openingId, setOpeningId] = useState<string | null>(null);

  function applyFilters(txs: MultiQueueTransaction[]) {
    return txs.filter((tx) => {
      if (cashierFilter !== "all" && tx.cashierId !== cashierFilter) return false;
      if (typeFilter !== "all" && tx.type !== typeFilter) return false;
      return true;
    });
  }

  const filtered = applyFilters(pending);
  const unassigned    = filtered.filter((tx) => tx.status === "unassigned");
  const inProgress    = filtered.filter((tx) => tx.status === "pending");
  const preConfirmed  = filtered.filter((tx) => tx.status === "preconfirmed");
  const postConfirmed = filtered.filter((tx) => tx.status === "postconfirmed");
  const filteredCompleted = applyFilters(completed);

  async function handleOpen(tx: MultiQueueTransaction) {
    setOpeningId(tx.id);
    try {
      const res = await fetch("/api/master/visit-cashier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashierId: tx.cashierId, role: "clerk" }),
      });
      const data = await res.json();
      if (data.redirect || res.ok) {
        router.push(`/${tx.cashierSlug}/${tx.cashierToken}/clerk/queue/${tx.id}`);
      }
    } finally {
      setOpeningId(null);
    }
  }

  function renderHandledBy(tx: MultiQueueTransaction) {
    if (!tx.lockedByClerkId) return "—";
    return (
      [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ") || "—"
    );
  }

  function renderTable(rows: MultiQueueTransaction[], showCashier = true, showHandledBy = false) {
    if (rows.length === 0) return null;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            {showCashier && <TableHead>Cashier</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Submitted</TableHead>
            {showHandledBy && <TableHead>Handled By</TableHead>}
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
              {showCashier && <TableCell className="text-sm">{tx.cashierName}</TableCell>}
              <TableCell><TypeBadge type={tx.type} /></TableCell>
              <TableCell className="text-sm">{tx.methodName}</TableCell>
              <TableCell className="text-sm">
                {tx.playerUsername ||
                  [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                  tx.playerEmail}
              </TableCell>
              <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
              </TableCell>
              {showHandledBy && (
                <TableCell className="text-sm text-muted-foreground">
                  {renderHandledBy(tx)}
                </TableCell>
              )}
              <TableCell>
                <Button size="sm" onClick={() => handleOpen(tx)} disabled={openingId !== null}>
                  {openingId === tx.id ? "Opening…" : "Open"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transaction Queue</h1>
        <div className="flex gap-2">
          <Select value={cashierFilter} onValueChange={(v) => { if (v !== null) setCashierFilter(v); }}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {cashierFilter === "all"
                  ? "All Cashiers"
                  : (cashiers.find((c) => c.id === cashierFilter)?.name ?? "All Cashiers")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cashiers</SelectItem>
              {cashiers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => { if (v !== null) setTypeFilter(v); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="payout">Payout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── New Transactions (Unassigned) ── */}
      <Card className={unassigned.length > 0 ? "border-amber-400 shadow-md shadow-amber-100" : ""}>
        <CardHeader className={unassigned.length > 0 ? "bg-amber-50 rounded-t-lg" : ""}>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">New Transactions</CardTitle>
            {unassigned.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5 min-w-[1.5rem] animate-pulse">
                {unassigned.length}
              </span>
            )}
          </div>
          {unassigned.length > 0 && (
            <p className="text-sm text-amber-700 mt-1">
              {unassigned.length === 1 ? "1 transaction waiting to be assigned." : `${unassigned.length} transactions waiting to be assigned.`}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {unassigned.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No new transactions.</p>
            : renderTable(unassigned)}
        </CardContent>
      </Card>

      {/* ── Pending ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Pending</CardTitle>
            {inProgress.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
                {inProgress.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {inProgress.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No pending transactions.</p>
            : renderTable(inProgress, true, true)}
        </CardContent>
      </Card>

      {/* ── Pre-Confirmed ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Pre-Confirmed</CardTitle>
            {preConfirmed.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
                {preConfirmed.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {preConfirmed.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No pre-confirmed transactions.</p>
            : renderTable(preConfirmed, true, true)}
        </CardContent>
      </Card>

      {/* ── Post-Confirmed ── */}
      {postConfirmed.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Post-Confirmed</CardTitle>
              <span className="inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 min-w-[1.5rem]">
                {postConfirmed.length}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {renderTable(postConfirmed, true, true)}
          </CardContent>
        </Card>
      )}

      {/* ── Completed ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCompleted.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No completed transactions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Cashier</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompleted.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.cashierName}</TableCell>
                    <TableCell><TypeBadge type={tx.type} /></TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {tx.playerUsername ||
                        [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                        tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(tx.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TX_STATUS_BADGE_VARIANT[tx.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary"} className="capitalize">
                        {TX_STATUS_LABEL[tx.status as keyof typeof TX_STATUS_LABEL] ?? tx.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
