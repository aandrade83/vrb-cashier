"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TX_STATUS_BADGE_VARIANT, TX_STATUS_LABEL } from "@/lib/transaction-statuses";
import type { PlayerTransactionDetail } from "@/data/transactions";
import { savePlayerNoteAction } from "../actions";

interface Props {
  detail: PlayerTransactionDetail;
  slug: string;
  token: string;
  basePath: string;
}

export function TransactionDetailDialog({ detail, slug, token, basePath }: Props) {
  const router = useRouter();
  const [note, setNote] = useState(detail.internalNote ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    router.push(basePath, { scroll: false } as never);
  }

  function handleSave() {
    startTransition(async () => {
      await savePlayerNoteAction({ transactionId: detail.id, note, slug, token });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{detail.referenceCode}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={TX_STATUS_BADGE_VARIANT[detail.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary"}
              className="capitalize w-fit"
            >
              {TX_STATUS_LABEL[detail.status as keyof typeof TX_STATUS_LABEL] ?? detail.status}
            </Badge>

            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline" className="capitalize w-fit">{detail.type}</Badge>

            <span className="text-muted-foreground">Method</span>
            <span>{detail.methodName}</span>

            <span className="text-muted-foreground">Amount</span>
            <span className="font-medium">{detail.currency} {detail.amount}</span>

            <span className="text-muted-foreground">Submitted</span>
            <span>{format(detail.createdAt, "do MMM yyyy, HH:mm")}</span>

            {detail.deniedReason && (
              <>
                <span className="text-muted-foreground">Denied reason</span>
                <span className="text-destructive">{detail.deniedReason}</span>
              </>
            )}
          </div>

          {/* Notes from support */}
          {detail.notesToPlayer.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Messages</p>
                {detail.notesToPlayer.map((n) => (
                  <div key={n.id} className="rounded-md bg-muted px-3 py-2 text-sm space-y-1">
                    <p>{n.noteToPlayer}</p>
                    <p className="text-xs text-muted-foreground">{format(n.createdAt, "do MMM yyyy, HH:mm")}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Internal note (player editable) */}
          <Separator />
          <div className="space-y-2">
            <label className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              My note
            </label>
            <textarea
              className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add a personal note about this transaction..."
              value={note}
              onChange={(e) => { setNote(e.target.value); setSaved(false); }}
              maxLength={1000}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{note.length}/1000</span>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
              >
                {saved ? "Saved" : isPending ? "Saving..." : "Save note"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
