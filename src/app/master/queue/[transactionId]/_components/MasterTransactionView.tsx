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
  NEXT_STATUSES_ADMIN,
  TERMINAL_STATUSES,
} from "@/lib/transaction-statuses";
import type { MasterTransactionDetail } from "@/data/queue";
import {
  masterUpdateTransactionStatusAction,
  masterAdminTakeTransactionAction,
  releaseNameManuallyAction,
} from "@/app/master/queue/actions";

interface Props {
  transaction: MasterTransactionDetail;
  myClerkId: string | null;
  lockedName: { id: string; value: string } | null;
}

export function MasterTransactionView({ transaction: tx, myClerkId, lockedName }: Props) {
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

  const [releasePending, setReleasePending] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const statusLabel = TX_STATUS_LABEL[tx.status as keyof typeof TX_STATUS_LABEL] ?? tx.status;
  const statusVariant =
    TX_STATUS_BADGE_VARIANT[tx.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary";

  const allowedStatuses = NEXT_STATUSES_ADMIN[tx.status] ?? [];
  const isFinalized = TERMINAL_STATUSES.includes(tx.status as never);
  const isAssigned = !!tx.lockedByClerkId;
  const isMineTx = !!myClerkId && tx.lockedByClerkId === myClerkId;
  const isDenying = newStatus === "denied";
  const isValid = !isDenying || deniedReason.trim().length >= 3;

  const lockedClerkName = tx.lockedByClerkId
    ? [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ") ||
      tx.lockedByClerkUsername ||
      "a clerk"
    : null;

  async function handleTake() {
    setTakeError(null);
    setTakePending(true);
    const result = await masterAdminTakeTransactionAction({ transactionId: tx.id });
    setTakePending(false);
    if (result.success) {
      router.refresh();
    } else {
      setTakeError(result.error);
    }
  }

  async function handleReleaseName() {
    setReleaseError(null);
    setReleasePending(true);
    const result = await releaseNameManuallyAction(tx.id);
    setReleasePending(false);
    if (result.success) {
      router.refresh();
    } else {
      setReleaseError(result.error);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      const result = await masterUpdateTransactionStatusAction({
        transactionId: tx.id,
        newStatus: newStatus || undefined,
        noteToPlayer,
        internalNote: internalNote || undefined,
        deniedReason: isDenying ? deniedReason : undefined,
      });
      if (result.success) {
        router.push("/master/queue");
      } else {
        setError(result.error);
      }
    });
  }

  // Build unified history timeline
  const historyEvents: {
    id: string;
    ts: Date;
    actor: string;
    label: string;
    note?: string | null;
    type: "created" | "status";
    from?: string;
    to?: string;
  }[] = [
    {
      id: "created",
      ts: tx.createdAt,
      actor: [tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || "Player",
      label: "Transaction submitted",
      type: "created" as const,
    },
    ...tx.updates.map((upd) => ({
      id: upd.id,
      ts: upd.createdAt,
      actor:
        [upd.clerkFirstName, upd.clerkLastName].filter(Boolean).join(" ") || "Master Admin",
      label: "Status updated",
      note: upd.noteToPlayer,
      type: "status" as const,
      from: TX_STATUS_LABEL[upd.previousStatus as keyof typeof TX_STATUS_LABEL] ?? upd.previousStatus,
      to: TX_STATUS_LABEL[upd.newStatus as keyof typeof TX_STATUS_LABEL] ?? upd.newStatus,
    })),
  ].sort((a, b) => a.ts.getTime() - b.ts.getTime());

  return (
    <div className="space-y-4">
      <Link
        href="/master/queue"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        ← Back to Queue
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left column: transaction info ── */}
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
                {tx.completedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                      Completed
                    </p>
                    <p>{format(tx.completedAt, "do MMM yyyy, HH:mm")}</p>
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

          {tx.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {tx.attachments.map((att) => (
                  <div key={att.id}>
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      {att.fileName}
                    </a>
                    <span className="text-muted-foreground ml-2 text-xs">{att.fileType}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: admin panel ── */}
        <div className="space-y-4">
          {/* Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {isMineTx ? (
                <p className="text-muted-foreground">
                  Assigned to <strong className="text-foreground">you</strong>
                  {tx.lockedAt ? ` since ${format(tx.lockedAt, "HH:mm")}` : ""}
                </p>
              ) : lockedClerkName ? (
                <p className="text-muted-foreground">
                  Assigned to{" "}
                  <strong className="text-foreground">{lockedClerkName}</strong>
                  {tx.lockedAt ? ` since ${format(tx.lockedAt, "HH:mm")}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">Not assigned.</p>
              )}

              {!isFinalized && !isMineTx && !lockedClerkName && (
                <>
                  {takeError && <p className="text-xs text-destructive">{takeError}</p>}
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={handleTake}
                    disabled={takePending}
                  >
                    {takePending ? "Taking…" : "Take Transaction"}
                  </Button>
                </>
              )}

              {!isFinalized && !isMineTx && lockedClerkName && !showTakeoverConfirm && (
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

              {!isFinalized && !isMineTx && lockedClerkName && showTakeoverConfirm && (
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
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={handleTake}
                      disabled={takePending}
                    >
                      {takePending ? "Taking…" : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}

              {lockedName && (
                <div className="space-y-1 pt-1 border-t">
                  <p className="text-xs text-muted-foreground">
                    Locked name: <span className="font-mono font-medium text-foreground">{lockedName.value}</span>
                  </p>
                  {releaseError && <p className="text-xs text-destructive">{releaseError}</p>}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleReleaseName}
                    disabled={releasePending}
                  >
                    {releasePending ? "Releasing…" : "Release Name"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Update Transaction */}
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
                          New Status{" "}
                          <span className="text-muted-foreground text-xs">(optional)</span>
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
                                ? (allowedStatuses.find((s) => s.value === newStatus)?.label ??
                                  newStatus)
                                : "No status change…"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {allowedStatuses.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
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

      {/* ── History timeline ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l border-border ml-3 space-y-6">
            {historyEvents.map((evt, i) => (
              <li key={evt.id} className="ml-6">
                <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full border bg-background">
                  {evt.type === "created" ? (
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(evt.ts, "do MMM yyyy, HH:mm")}
                  </time>
                  <span className="text-xs font-medium">{evt.actor}</span>
                </div>
                {evt.type === "status" && evt.from && evt.to ? (
                  <p className="mt-0.5 text-sm">
                    <span className="text-muted-foreground">{evt.from}</span>
                    {" → "}
                    <strong>{evt.to}</strong>
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted-foreground">{evt.label}</p>
                )}
                {evt.note && (
                  <p className="mt-1 text-sm text-muted-foreground italic">"{evt.note}"</p>
                )}
                {i < historyEvents.length - 1 && <div className="mt-6" />}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
