"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { takeOverTransactionAction } from "../../actions";

interface Props {
  transactionId: string;
  onSuccess?: () => void;
}

export function TakeOverDialog({ transactionId, onSuccess }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await takeOverTransactionAction(transactionId);
      if (result.success) {
        setOpen(false);
        if (onSuccess) {
          onSuccess();
        } else {
          router.refresh();
        }
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!isPending) { setOpen(v); setError(null); } }}>
      <AlertDialogTrigger render={<Button variant="default" size="sm" />}>
        Take Over
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Take over this transaction?</AlertDialogTitle>
          <AlertDialogDescription>
            This will release the current clerk&apos;s lock and assign the
            transaction to you. The other clerk will lose access immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive px-1">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Taking over…" : "Yes, take over"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
