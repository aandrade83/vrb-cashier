"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { renewLockAction } from "../../actions";
import { TakeOverDialog } from "./TakeOverDialog";

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | {
      acquired: false;
      lockedBy: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        lockedAt: Date | null;
      };
    };

interface Props {
  lockResult: LockResult;
  transactionId: string;
  currentClerkDbId: string;
}

export function LockBanner({ lockResult, transactionId, currentClerkDbId }: Props) {
  useEffect(() => {
    if (!lockResult.acquired) return;

    const interval = setInterval(() => {
      renewLockAction(transactionId);
    }, 10 * 60 * 1000); // every 10 minutes

    return () => clearInterval(interval);
  }, [lockResult.acquired, transactionId]);

  if (lockResult.acquired) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        You are handling this transaction.
      </div>
    );
  }

  const { lockedBy } = lockResult;
  const holderName =
    [lockedBy.firstName, lockedBy.lastName].filter(Boolean).join(" ") ||
    "another clerk";
  const lockedAtStr = lockedBy.lockedAt
    ? new Date(lockedBy.lockedAt).toLocaleTimeString()
    : "unknown time";

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 space-y-3">
      <p className="text-sm text-yellow-800">
        This transaction is currently being handled by{" "}
        <strong>{holderName}</strong> since {lockedAtStr}.
      </p>
      <div className="flex gap-2">
        <TakeOverDialog transactionId={transactionId} />
        <Link
          href="/clerk/queue"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to Queue
        </Link>
      </div>
    </div>
  );
}
