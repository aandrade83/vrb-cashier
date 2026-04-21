"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTransactionStatusAction } from "../../actions";
import {
  TERMINAL_STATUSES,
  NEXT_STATUSES_CLERK,
  NEXT_STATUSES_ADMIN,
} from "@/lib/transaction-statuses";

interface Props {
  transactionId: string;
  currentStatus: string;
  ownsLock: boolean;
  isMasterAdmin: boolean;
  queuePath?: string;
}

export function UpdateForm({
  transactionId,
  currentStatus,
  ownsLock,
  isMasterAdmin,
  queuePath = "/clerk/queue",
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState("");
  const [noteToPlayer, setNoteToPlayer] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [deniedReason, setDeniedReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const statusMap = isMasterAdmin ? NEXT_STATUSES_ADMIN : NEXT_STATUSES_CLERK;
  const allowedStatuses = statusMap[currentStatus] ?? [];
  const isFinalized = TERMINAL_STATUSES.includes(currentStatus as never);
  const isDenying = newStatus === "denied";

  // postconfirmed → only master_admin can do anything; block everyone else
  const isPostconfirmedAndNotAdmin = currentStatus === "postconfirmed" && !isMasterAdmin;

  const isValid =
    newStatus !== "" &&
    noteToPlayer.trim().length >= 10 &&
    (!isDenying || deniedReason.trim().length >= 3);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !ownsLock) return;
    setError(null);
    startTransition(async () => {
      const result = await updateTransactionStatusAction({
        transactionId,
        newStatus,
        noteToPlayer,
        internalNote: internalNote || undefined,
        deniedReason: isDenying ? deniedReason : undefined,
      });
      if (result.success) {
        router.push(queuePath);
      } else {
        setError(result.error);
      }
    });
  }

  if (isFinalized) {
    return <p className="text-sm text-muted-foreground">This transaction is finalized and cannot be updated.</p>;
  }

  if (isPostconfirmedAndNotAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        This transaction is post-confirmed and can only be completed by a master admin.
      </p>
    );
  }

  const disabled = !ownsLock || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!ownsLock && (
        <p className="text-sm text-muted-foreground">Take over the transaction to update it.</p>
      )}

      <div className="space-y-2">
        <Label htmlFor="newStatus">New Status</Label>
        <Select
          value={newStatus}
          onValueChange={(v) => { if (v) { setNewStatus(v); if (v !== "denied") setDeniedReason(""); } }}
          disabled={disabled}
        >
          <SelectTrigger id="newStatus">
            <SelectValue placeholder="Select a status…">
              {newStatus
                ? (allowedStatuses.find((s) => s.value === newStatus)?.label ?? newStatus)
                : "Select a status…"}
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
            Denial Reason <span className="text-destructive text-xs">(required)</span>
          </Label>
          <textarea
            id="deniedReason"
            value={deniedReason}
            onChange={(e) => setDeniedReason(e.target.value)}
            placeholder="Reason for denying this transaction…"
            rows={2}
            disabled={disabled}
            required
            minLength={3}
            className="w-full rounded-md border border-destructive/50 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="noteToPlayer">
          Note to Player <span className="text-muted-foreground text-xs">(required, min 10 chars)</span>
        </Label>
        <textarea
          id="noteToPlayer"
          value={noteToPlayer}
          onChange={(e) => setNoteToPlayer(e.target.value)}
          placeholder="Message sent to the player…"
          rows={4}
          disabled={disabled}
          required
          minLength={10}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNote">
          Internal Note <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <textarea
          id="internalNote"
          value={internalNote}
          onChange={(e) => setInternalNote(e.target.value)}
          placeholder="Internal notes for the cashier team…"
          rows={3}
          disabled={disabled}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={disabled || !isValid} className="w-full">
        {isPending ? "Updating…" : "Update & Notify Player"}
      </Button>
    </form>
  );
}
