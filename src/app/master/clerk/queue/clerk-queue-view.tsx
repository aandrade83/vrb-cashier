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

interface Props {
  pending: MultiQueueTransaction[];
  completed: MultiQueueTransaction[];
  cashiers: Pick<Cashier, "id" | "name">[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  post_confirmed: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Unassigned",
  in_progress: "Pending",
  approved: "Pre-Confirmed",
  post_confirmed: "Post-Confirmed",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
};

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

  const filteredPending = applyFilters(pending);
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
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
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

      {/* ── Pending / In Progress ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredPending.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No pending transactions.
            </p>
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
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Handled By</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPending.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.cashierName}</TableCell>
                    <TableCell>
                      <TypeBadge type={tx.type} />
                    </TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {tx.playerUsername ||
                        [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                        tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {tx.currency} {tx.amount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[tx.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {STATUS_LABEL[tx.status] ?? tx.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {renderHandledBy(tx)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleOpen(tx)}
                        disabled={openingId !== null}
                      >
                        {openingId === tx.id ? "Opening..." : "Open"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Completed ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredCompleted.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No completed transactions.
            </p>
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
                    <TableCell>
                      <TypeBadge type={tx.type} />
                    </TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {tx.playerUsername ||
                        [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") ||
                        tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {tx.currency} {tx.amount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(tx.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[tx.status] ?? "secondary"}
                        className="capitalize"
                      >
                        {STATUS_LABEL[tx.status] ?? tx.status.replace("_", " ")}
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
