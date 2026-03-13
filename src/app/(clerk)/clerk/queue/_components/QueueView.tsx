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
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export function QueueView({
  pending,
  completedDeposits,
  completedPayouts,
  currentClerkDbId,
}: Props) {
  const [completedType, setCompletedType] = useState<"deposit" | "payout">("deposit");

  const completed = completedType === "deposit" ? completedDeposits : completedPayouts;

  function renderActionCell(tx: QueueTransaction) {
    const isOwnLock = tx.lockedByClerkId === currentClerkDbId;
    const isOtherLock = tx.lockedByClerkId !== null && !isOwnLock;
    let label = "Open";
    let variant: "default" | "outline" = "default";
    if (isOwnLock) label = "Continue";
    else if (isOtherLock) { label = "Take Over"; variant = "outline"; }

    return (
      <Link href={`/clerk/queue/${tx.id}`} className={cn(buttonVariants({ variant, size: "sm" }))}>
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Transaction Queue</h1>

      {/* ── Pending / In Progress ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending &amp; In Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">
              No pending transactions. The queue is clear.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Handled By</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell>{renderTypeBadge(tx.type)}</TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize">
                        {tx.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{renderHandledBy(tx)}</TableCell>
                    <TableCell>{renderActionCell(tx)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
            <p className="text-center text-muted-foreground py-12 text-sm">
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
                      {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(tx.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize">
                        {tx.status.replace("_", " ")}
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
