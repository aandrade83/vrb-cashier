"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
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
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import type { QueueTransaction } from "@/data/queue";

interface Props {
  pending: QueueTransaction[];
  completedDeposits: QueueTransaction[];
  completedPayouts: QueueTransaction[];
  currentClerkDbId: string;
  basePath?: string;
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

export function QueueView({
  pending,
  completedDeposits,
  completedPayouts,
  currentClerkDbId,
  basePath = "/clerk",
}: Props) {
  const [completedType, setCompletedType] = useState<"deposit" | "payout">("deposit");

  const unassigned = pending.filter((tx) => tx.status === "pending");
  const inProgress = pending.filter((tx) => tx.status === "in_progress");
  const preConfirmed = pending.filter((tx) => tx.status === "approved");
  const postConfirmed = pending.filter((tx) => tx.status === "post_confirmed");
  const completed = completedType === "deposit" ? completedDeposits : completedPayouts;

  function renderActionCell(tx: QueueTransaction) {
    const isOwnLock = tx.lockedByClerkId === currentClerkDbId && currentClerkDbId !== "";
    const isOtherLock = tx.lockedByClerkId !== null && !isOwnLock;
    let label = "Open";
    let variant: "default" | "outline" = "default";
    if (isOwnLock) { label = "Continue"; }
    else if (isOtherLock) { label = "Take Over"; variant = "outline"; }

    return (
      <Link href={`${basePath}/queue/${tx.id}`} className={cn(buttonVariants({ variant, size: "sm" }))}>
        {label}
      </Link>
    );
  }

  function renderHandledBy(tx: QueueTransaction) {
    if (!tx.lockedByClerkId) return "—";
    return [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ") || "—";
  }

  function renderTypeBadge(type: string) {
    return (
      <Badge
        variant="outline"
        className={type === "deposit" ? "border-green-500 text-green-700" : "border-orange-500 text-orange-700"}
      >
        {type === "deposit" ? "Deposit" : "Payout"}
      </Badge>
    );
  }

  function renderTable(rows: QueueTransaction[], showHandledBy = false) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Player Account</TableHead>
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
              <TableCell>{renderTypeBadge(tx.type)}</TableCell>
              <TableCell className="text-sm">{tx.methodName}</TableCell>
              <TableCell className="text-sm">
                {tx.playerUsername || [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
              </TableCell>
              <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
              </TableCell>
              {showHandledBy && (
                <TableCell className="text-sm text-muted-foreground">{renderHandledBy(tx)}</TableCell>
              )}
              <TableCell>{renderActionCell(tx)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Transaction Queue</h1>

      {/* ── New Transactions (Unassigned) ── */}
      <Card className={unassigned.length > 0 ? "border-amber-400 shadow-md shadow-amber-100" : ""}>
        <CardHeader className={unassigned.length > 0 ? "bg-amber-50 rounded-t-lg" : ""}>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">
              New Transactions
            </CardTitle>
            {unassigned.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold px-2 py-0.5 min-w-[1.5rem] animate-pulse">
                {unassigned.length}
              </span>
            )}
          </div>
          {unassigned.length > 0 && (
            <p className="text-sm text-amber-700 mt-1">
              {unassigned.length === 1 ? "1 transaction is waiting to be assigned." : `${unassigned.length} transactions are waiting to be assigned.`}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {unassigned.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No new transactions.</p>
          ) : (
            renderTable(unassigned)
          )}
        </CardContent>
      </Card>

      {/* ── Pending (assigned to clerk) ── */}
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
          {inProgress.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No pending transactions.</p>
          ) : (
            renderTable(inProgress, true)
          )}
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
          {preConfirmed.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No pre-confirmed transactions.</p>
          ) : (
            renderTable(preConfirmed, true)
          )}
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
            {renderTable(postConfirmed, true)}
          </CardContent>
        </Card>
      )}

      {/* ── Completed ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Completed Transactions</CardTitle>
          <Select
            value={completedType}
            onValueChange={(v) => { if (v !== null) setCompletedType(v as "deposit" | "payout"); }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deposit">Deposits</SelectItem>
              <SelectItem value="payout">Payouts</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {completed.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No completed {completedType}s yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completed.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {tx.playerUsername || [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(tx.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize">
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
