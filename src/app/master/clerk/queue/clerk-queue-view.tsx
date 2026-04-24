"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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
import type { MultiQueueTransaction, PlayerDepositSummaryRow } from "@/data/queue";
import type { Cashier } from "@/db/schema";
import { TX_STATUS_LABEL, TX_STATUS_BADGE_VARIANT } from "@/lib/transaction-statuses";
import { getPlayerDepositSummaryAction } from "@/app/master/queue/actions";

interface Props {
  pending: MultiQueueTransaction[];
  completed: MultiQueueTransaction[];
  cashiers: Pick<Cashier, "id" | "name">[];
  transactionBasePath?: string;
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

export function ClerkQueueView({ pending, completed, cashiers, transactionBasePath }: Props) {
  const router = useRouter();
  const [cashierFilter, setCashierFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [router]);

  const [playerDialogName, setPlayerDialogName] = useState<string | null>(null);
  const [playerSummaryRows, setPlayerSummaryRows] = useState<PlayerDepositSummaryRow[] | null>(null);
  const [playerSummaryLoading, setPlayerSummaryLoading] = useState(false);

  async function handlePlayerClick(tx: MultiQueueTransaction) {
    const displayName =
      tx.playerUsername ||
      [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
      tx.playerEmail ||
      "Player";
    setPlayerDialogName(displayName);
    setPlayerSummaryRows(null);
    setPlayerSummaryLoading(true);
    const result = await getPlayerDepositSummaryAction(tx.playerId, tx.cashierId);
    setPlayerSummaryLoading(false);
    setPlayerSummaryRows(result.success ? result.rows : []);
  }

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

  function handleOpen(tx: MultiQueueTransaction) {
    if (!transactionBasePath) return;
    setOpeningId(tx.id);
    router.push(`${transactionBasePath}/${tx.id}`);
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
            {transactionBasePath && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
              {showCashier && <TableCell className="text-sm">{tx.cashierName}</TableCell>}
              <TableCell><TypeBadge type={tx.type} /></TableCell>
              <TableCell className="text-sm max-w-[160px]">
                <span className="block truncate" title={tx.methodName}>{tx.methodName}</span>
              </TableCell>
              <TableCell className="text-sm">
                <button
                  type="button"
                  className="text-left underline underline-offset-2 hover:no-underline text-foreground uppercase"
                  onClick={() => handlePlayerClick(tx)}
                >
                  {tx.playerUsername ||
                    [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                    tx.playerEmail}
                </button>
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
              {transactionBasePath && (
                <TableCell>
                  <Button size="sm" onClick={() => handleOpen(tx)} disabled={openingId !== null}>
                    {openingId === tx.id ? "Opening…" : "Open"}
                  </Button>
                </TableCell>
              )}
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

      {/* ── Player Deposit Summary Dialog ── */}
      <Dialog open={playerDialogName !== null} onOpenChange={(open) => { if (!open) { setPlayerDialogName(null); setPlayerSummaryRows(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="uppercase">Deposit History — {playerDialogName}</DialogTitle>
          </DialogHeader>
          {playerSummaryLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>
          ) : playerSummaryRows && playerSummaryRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No completed deposits found.</p>
          ) : playerSummaryRows && playerSummaryRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-center">Count</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playerSummaryRows.map((row) => (
                  <TableRow key={row.methodName}>
                    <TableCell className="text-sm">
                      <span title={row.methodName} className="cursor-default">
                        {row.methodName.split(/\s+/)[0]}…
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">{row.count}</TableCell>
                    <TableCell className="text-right text-sm font-medium">${row.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-center font-semibold">
                    {playerSummaryRows.reduce((s, r) => s + r.count, 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ${playerSummaryRows.reduce((s, r) => s + r.total, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : null}
        </DialogContent>
      </Dialog>

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
                  {transactionBasePath && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompleted.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.cashierName}</TableCell>
                    <TableCell><TypeBadge type={tx.type} /></TableCell>
                    <TableCell className="text-sm max-w-[160px]">
                      <span className="block truncate" title={tx.methodName}>{tx.methodName}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <button
                        type="button"
                        className="text-left underline underline-offset-2 hover:no-underline text-foreground uppercase"
                        onClick={() => handlePlayerClick(tx)}
                      >
                        {tx.playerUsername ||
                          [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                          tx.playerEmail}
                      </button>
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
                    {transactionBasePath && (
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleOpen(tx)} disabled={openingId !== null}>
                          {openingId === tx.id ? "Opening…" : "Open"}
                        </Button>
                      </TableCell>
                    )}
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
