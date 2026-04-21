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
import { TX_STATUS_LABEL, TX_STATUS_BADGE_VARIANT } from "@/lib/transaction-statuses";
import type { QueueTransaction } from "@/data/queue";

interface Props {
  active: QueueTransaction[];
  completedDeposits: QueueTransaction[];
  completedPayouts: QueueTransaction[];
  deniedDeposits: QueueTransaction[];
  deniedPayouts: QueueTransaction[];
  currentClerkDbId: string;
  isMasterAdmin: boolean;
  basePath?: string;
}

export function QueueView({
  active,
  completedDeposits,
  completedPayouts,
  deniedDeposits,
  deniedPayouts,
  currentClerkDbId,
  isMasterAdmin,
  basePath = "/clerk",
}: Props) {
  const [completedType, setCompletedType] = useState<"deposit" | "payout">("deposit");
  const [deniedType, setDeniedType] = useState<"deposit" | "payout">("deposit");

  const unassigned    = active.filter((tx) => tx.status === "unassigned");
  const pending       = active.filter((tx) => tx.status === "pending");
  const preconfirmed  = active.filter((tx) => tx.status === "preconfirmed");
  const postconfirmed = active.filter((tx) => tx.status === "postconfirmed");

  const completedRows = completedType === "deposit" ? completedDeposits : completedPayouts;
  const deniedRows    = deniedType    === "deposit" ? deniedDeposits    : deniedPayouts;

  function renderActionCell(tx: QueueTransaction) {
    const isOwnLock   = tx.lockedByClerkId === currentClerkDbId && currentClerkDbId !== "";
    const isOtherLock = tx.lockedByClerkId !== null && !isOwnLock;
    const label   = isOwnLock ? "Continue" : isOtherLock ? "Take Over" : "Open";
    const variant: "default" | "outline" = isOtherLock ? "outline" : "default";
    return (
      <Link href={`${basePath}/queue/${tx.id}`} className={cn(buttonVariants({ variant, size: "sm" }))}>
        {label}
      </Link>
    );
  }

  function renderHandledBy(tx: QueueTransaction) {
    if (!tx.lockedByClerkId) return "—";
    const name = [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ");
    return name || tx.lockedByClerkUsername || "—";
  }

  function TypeBadge({ type }: { type: string }) {
    return (
      <Badge
        variant="outline"
        className={type === "deposit" ? "border-green-500 text-green-700" : "border-orange-500 text-orange-700"}
      >
        {type === "deposit" ? "Deposit" : "Payout"}
      </Badge>
    );
  }

  function ActiveTable({ rows, showHandledBy = false }: { rows: QueueTransaction[]; showHandledBy?: boolean }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Submitted</TableHead>
            {showHandledBy && <TableHead>Handled By</TableHead>}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
              <TableCell><TypeBadge type={tx.type} /></TableCell>
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

  function HistoryTable({ rows }: { rows: QueueTransaction[] }) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((tx) => (
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
                <Badge variant={TX_STATUS_BADGE_VARIANT[tx.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary"}>
                  {TX_STATUS_LABEL[tx.status as keyof typeof TX_STATUS_LABEL] ?? tx.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  function CountBadge({ count, amber = false }: { count: number; amber?: boolean }) {
    if (count === 0) return null;
    return (
      <span className={cn(
        "inline-flex items-center justify-center rounded-full text-xs font-bold px-2 py-0.5 min-w-[1.5rem]",
        amber ? "bg-amber-500 text-white animate-pulse" : "bg-muted text-muted-foreground",
      )}>
        {count}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Transaction Queue</h1>

      {/* ── Unassigned ── */}
      <Card className={unassigned.length > 0 ? "border-amber-400 shadow-md shadow-amber-100" : ""}>
        <CardHeader className={unassigned.length > 0 ? "bg-amber-50 rounded-t-lg" : ""}>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Unassigned</CardTitle>
            <CountBadge count={unassigned.length} amber />
          </div>
          {unassigned.length > 0 && (
            <p className="text-sm text-amber-700 mt-1">
              {unassigned.length === 1
                ? "1 transaction waiting to be assigned."
                : `${unassigned.length} transactions waiting to be assigned.`}
            </p>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {unassigned.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No unassigned transactions.</p>
            : <ActiveTable rows={unassigned} />}
        </CardContent>
      </Card>

      {/* ── Pending ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Pending</CardTitle>
            <CountBadge count={pending.length} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No pending transactions.</p>
            : <ActiveTable rows={pending} showHandledBy />}
        </CardContent>
      </Card>

      {/* ── Pre-Confirmed ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">Pre-Confirmed</CardTitle>
            <CountBadge count={preconfirmed.length} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {preconfirmed.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No pre-confirmed transactions.</p>
            : <ActiveTable rows={preconfirmed} showHandledBy />}
        </CardContent>
      </Card>

      {/* ── Post-Confirmed (master_admin only) ── */}
      {isMasterAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">Post-Confirmed</CardTitle>
              <CountBadge count={postconfirmed.length} />
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Admin only</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {postconfirmed.length === 0
              ? <p className="text-center text-muted-foreground py-8 text-sm">No post-confirmed transactions.</p>
              : <ActiveTable rows={postconfirmed} showHandledBy />}
          </CardContent>
        </Card>
      )}

      {/* ── Denied ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recently Denied</CardTitle>
          <Select value={deniedType} onValueChange={(v) => { if (v) setDeniedType(v as "deposit" | "payout"); }}>
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
          {deniedRows.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No denied {deniedType}s.</p>
            : <HistoryTable rows={deniedRows} />}
        </CardContent>
      </Card>

      {/* ── Completed ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recently Completed</CardTitle>
          <Select value={completedType} onValueChange={(v) => { if (v) setCompletedType(v as "deposit" | "payout"); }}>
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
          {completedRows.length === 0
            ? <p className="text-center text-muted-foreground py-8 text-sm">No completed {completedType}s yet.</p>
            : <HistoryTable rows={completedRows} />}
        </CardContent>
      </Card>
    </div>
  );
}
