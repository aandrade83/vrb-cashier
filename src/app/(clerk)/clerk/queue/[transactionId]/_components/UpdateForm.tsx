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

interface Props {
  transactionId: string;
  ownsLock: boolean;
}

export function UpdateForm({ transactionId, ownsLock }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newStatus, setNewStatus] = useState("");
  const [noteToPlayer, setNoteToPlayer] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isValid =
    newStatus !== "" && noteToPlayer.trim().length >= 10;

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
      });

      if (result.success) {
        router.push("/clerk/queue");
      } else {
        setError(result.error);
      }
    });
  }

  const disabled = !ownsLock || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!ownsLock && (
        <p className="text-sm text-muted-foreground">
          You must own the lock to update this transaction.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="newStatus">New Status</Label>
        <Select
          value={newStatus}
          onValueChange={(v) => { if (v !== null) setNewStatus(v); }}
          disabled={disabled}
        >
          <SelectTrigger id="newStatus">
            <SelectValue placeholder="Select a status…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="noteToPlayer">
          Note to Player{" "}
          <span className="text-muted-foreground text-xs">(required, min 10 chars)</span>
        </Label>
        <textarea
          id="noteToPlayer"
          value={noteToPlayer}
          onChange={(e) => setNoteToPlayer(e.target.value)}
          placeholder="Message sent to the player via email…"
          rows={4}
          disabled={disabled}
          required
          minLength={10}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="internalNote">
          Internal Note{" "}
          <span className="text-muted-foreground text-xs">(optional, not shown to player)</span>
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

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button
        type="submit"
        disabled={disabled || !isValid}
        className="w-full"
      >
        {isPending ? "Updating…" : "Update & Notify Player"}
      </Button>
    </form>
  );
}
