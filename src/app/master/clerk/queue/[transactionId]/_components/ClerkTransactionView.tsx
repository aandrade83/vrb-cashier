"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import {
  TX_STATUS_LABEL,
  TX_STATUS_BADGE_VARIANT,
  NEXT_STATUSES_CLERK,
  TERMINAL_STATUSES,
} from "@/lib/transaction-statuses";
import type { MasterTransactionDetail } from "@/data/queue";
import { masterClerkUpdateTransactionStatusAction, masterClerkTakeTransactionAction } from "@/app/master/clerk/queue/actions";

interface Props {
  transaction: MasterTransactionDetail;
  myClerkId: string | null;
}

export function ClerkTransactionView({ transaction: tx, myClerkId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState("");
  const [noteToPlayer, setNoteToPlayer] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [deniedReason, setDeniedReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [takePending, setTakePending] = useState(false);
  const [takeError, setTakeError] = useState<string | null>(null);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);

  const statusLabel = TX_STATUS_LABEL[tx.status as keyof typeof TX_STATUS_LABEL] ?? tx.status;
  const statusVariant =
    TX_STATUS_BADGE_VARIANT[tx.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary";

  const allowedStatuses = NEXT_STATUSES_CLERK[tx.status] ?? [];
  const isFinalized = TERMINAL_STATUSES.includes(tx.status as never);
  const isAssigned = !!tx.lockedByClerkId;
  const isDenying = newStatus === "denied";
  const isValid = (!isDenying || deniedReason.trim().length >= 3);

  async function handleTake() {
    setTakeError(null);
    setTakePending(true);
    const result = await masterClerkTakeTransactionAction({ transactionId: tx.id });
    setTakePending(false);
    if (result.success) {
      router.refresh();
    } else {
      setTakeError(result.error);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      const result = await masterClerkUpdateTransactionStatusAction({
        transactionId: tx.id,
        newStatus,
        noteToPlayer,
        internalNote: internalNote || undefined,
        deniedReason: isDenying ? deniedReason : undefined,
      });
      if (result.success) {
        router.push("/master/clerk/queue");
      } else {
        setError(result.error);
      }
    });
  }

  const lockedClerkName = tx.lockedByClerkId
    ? [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ") ||
      tx.lockedByClerkUsername ||
      "a clerk"
    : null;

  return (
    <div className="space-y-4">
      <Link
        href="/master/clerk/queue"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        ← Back to Queue
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left column ── */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-semibold">{tx.referenceCode}</span>
                <Badge
                  variant="outline"
                  className={
                    tx.type === "deposit"
                      ? "border-green-500 text-green-700"
                      : "border-orange-500 text-orange-700"
                  }
                >
                  {tx.type === "deposit" ? "Deposit" : "Payout"}
                </Badge>
                <Badge variant={statusVariant} className="capitalize">
                  {statusLabel}
                </Badge>
              </div>
              {tx.status === "denied" && tx.deniedReason && (
                <p className="text-sm text-destructive mt-1">
                  <span className="font-medium">Denial reason:</span> {tx.deniedReason}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Player
                  </p>
                  <p>
                    {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="text-muted-foreground">{tx.playerEmail ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Method
                  </p>
                  <p>{tx.methodName}</p>
                  <p className="text-muted-foreground capitalize">{tx.methodType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Amount
                  </p>
                  <p className="font-medium">
                    {tx.currency} {tx.amount}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Submitted
                  </p>
                  <p>{format(tx.createdAt, "do MMM yyyy, HH:mm")}</p>
                </div>
                {tx.assignedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                      Assigned
                    </p>
                    <p>{format(tx.assignedAt, "do MMM yyyy, HH:mm")}</p>
                  </div>
                )}
                {tx.preconfirmedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                      Pre-Confirmed
                    </p>
                    <p>{format(tx.preconfirmedAt, "do MMM yyyy, HH:mm")}</p>
                  </div>
                )}
                {tx.postconfirmedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                      Post-Confirmed
                    </p>
                    <p>{format(tx.postconfirmedAt, "do MMM yyyy, HH:mm")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {tx.fieldValues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Form Submission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {tx.fieldValues.map((fv) => (
                  <div key={fv.id}>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                      {fv.fieldLabelSnapshot}
                    </p>
                    {fv.fieldTypeSnapshot === "image" || fv.fieldTypeSnapshot === "file" ? (
                      fv.value ? (
                        <a
                          href={fv.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          View attachment
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    ) : (
                      <p>{fv.value || "—"}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tx.updates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {tx.updates.map((upd, i) => (
                  <div key={upd.id}>
                    {i > 0 && <Separator className="mb-4" />}
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">
                        {format(upd.createdAt, "do MMM yyyy, HH:mm")} ·{" "}
                        {[upd.clerkFirstName, upd.clerkLastName].filter(Boolean).join(" ") ||
                          "Master"}
                      </p>
                      <p className="capitalize">
                        <span className="text-muted-foreground">
                          {TX_STATUS_LABEL[upd.previousStatus as keyof typeof TX_STATUS_LABEL] ??
                            upd.previousStatus}
                        </span>
                        {" → "}
                        <strong>
                          {TX_STATUS_LABEL[upd.newStatus as keyof typeof TX_STATUS_LABEL] ??
                            upd.newStatus}
                        </strong>
                      </p>
                      {upd.noteToPlayer && (
                        <p className="text-muted-foreground">{upd.noteToPlayer}</p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {lockedClerkName ? (
                <p className="text-muted-foreground">
                  Assigned to{" "}
                  <strong className="text-foreground">{lockedClerkName}</strong>
                  {tx.lockedAt ? ` since ${format(tx.lockedAt, "HH:mm")}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">Not assigned.</p>
              )}
              {!isFinalized && !lockedClerkName && (
                <>
                  {takeError && <p className="text-xs text-destructive">{takeError}</p>}
                  <Button size="sm" className="w-full" onClick={handleTake} disabled={takePending}>
                    {takePending ? "Taking…" : "Take Transaction"}
                  </Button>
                </>
              )}
              {!isFinalized && lockedClerkName && tx.lockedByClerkId !== myClerkId && !showTakeoverConfirm && (
                <>
                  {takeError && <p className="text-xs text-destructive">{takeError}</p>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => { setTakeError(null); setShowTakeoverConfirm(true); }}
                    disabled={takePending}
                  >
                    Take Over
                  </Button>
                </>
              )}
              {!isFinalized && lockedClerkName && tx.lockedByClerkId !== myClerkId && showTakeoverConfirm && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600">
                    This will reassign the transaction to you.
                  </p>
                  {takeError && <p className="text-xs text-destructive">{takeError}</p>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowTakeoverConfirm(false)}
                      disabled={takePending}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" className="flex-1" onClick={handleTake} disabled={takePending}>
                      {takePending ? "Taking…" : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              {isFinalized ? (
                <p className="text-sm text-muted-foreground">
                  This transaction is finalized and cannot be updated.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {allowedStatuses.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="newStatus">
                          New Status <span className="text-muted-foreground text-xs">(optional)</span>
                        </Label>
                        <Select
                          value={newStatus}
                          onValueChange={(v) => {
                            if (v) {
                              setNewStatus(v);
                              if (v !== "denied") setDeniedReason("");
                            }
                          }}
                          disabled={isPending}
                        >
                          <SelectTrigger id="newStatus">
                            <SelectValue placeholder="No status change…">
                              {newStatus
                                ? (allowedStatuses.find((s) => s.value === newStatus)?.label ?? newStatus)
                                : "No status change…"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {allowedStatuses.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {isDenying && (
                        <div className="space-y-2">
                          <Label htmlFor="deniedReason">
                            Denial Reason{" "}
                            <span className="text-destructive text-xs">(required)</span>
                          </Label>
                          <textarea
                            id="deniedReason"
                            value={deniedReason}
                            onChange={(e) => setDeniedReason(e.target.value)}
                            placeholder="Reason for denying this transaction…"
                            rows={2}
                            disabled={isPending}
                            className="w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No status transitions available from the current state.
                    </p>
                  )}

                  {newStatus && (
                    <div className="space-y-2">
                      <Label htmlFor="noteToPlayer">
                        Note to Player{" "}
                        <span className="text-muted-foreground text-xs">(included in email)</span>
                      </Label>
                      <textarea
                        id="noteToPlayer"
                        value={noteToPlayer}
                        onChange={(e) => setNoteToPlayer(e.target.value)}
                        placeholder="Message for the player…"
                        rows={3}
                        disabled={isPending}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="internalNote">
                      Internal Note{" "}
                      <span className="text-muted-foreground text-xs">(not sent to anyone)</span>
                    </Label>
                    <textarea
                      id="internalNote"
                      value={internalNote}
                      onChange={(e) => setInternalNote(e.target.value)}
                      placeholder="Internal notes…"
                      rows={2}
                      disabled={isPending}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}

                  <Button
                    type="submit"
                    disabled={isPending || !isValid || !isAssigned}
                    className="w-full"
                  >
                    {isPending ? "Updating…" : "Update Transaction"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
