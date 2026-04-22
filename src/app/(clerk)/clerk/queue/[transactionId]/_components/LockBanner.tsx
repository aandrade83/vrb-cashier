"use client";

import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { TakeOverDialog } from "./TakeOverDialog";

type LockResult =
  | { acquired: true; lockedByClerkId: string }
  | {
      acquired: false;
      lockedBy: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        username: string | null;
        lockedAt: Date | null;
      };
    };

interface Props {
  lockResult: LockResult;
  transactionId: string;
  currentClerkDbId: string;
  queuePath?: string;
  isMasterActing?: boolean;
  masterHasTakenOver?: boolean;
  onMasterTakeOver?: () => void;
}

export function LockBanner({
  lockResult,
  transactionId,
  currentClerkDbId,
  queuePath = "/clerk/queue",
  isMasterActing = false,
  masterHasTakenOver = false,
  onMasterTakeOver,
}: Props) {
  // Master who has taken over
  if (isMasterActing && masterHasTakenOver) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        You are handling this transaction.
      </div>
    );
  }

  // Real clerk owns the lock
  if (lockResult.acquired && !isMasterActing) {
    return (
      <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        You are handling this transaction.
      </div>
    );
  }

  // Master acting with a clerk holding the lock — offer Take Over
  if (isMasterActing && !lockResult.acquired) {
    const lockedBy = lockResult.lockedBy;
    const hasClerkLock = lockedBy.id !== "";
    const holderName = hasClerkLock
      ? ([lockedBy.firstName, lockedBy.lastName].filter(Boolean).join(" ") || lockedBy.username || "a clerk")
      : null;
    const lockedAtStr =
      hasClerkLock && lockedBy.lockedAt ? new Date(lockedBy.lockedAt).toLocaleTimeString() : null;

    return (
      <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 space-y-3">
        <p className="text-sm text-yellow-800">
          {hasClerkLock ? (
            <>
              Being handled by <strong>{holderName}</strong>
              {lockedAtStr ? ` since ${lockedAtStr}` : ""}. Take over to release the clerk lock.
            </>
          ) : (
            "No clerk assigned yet."
          )}
        </p>
        {hasClerkLock && (
          <div className="flex gap-2">
            <TakeOverDialog transactionId={transactionId} onSuccess={onMasterTakeOver} />
            <Link href={queuePath} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Back to Queue
            </Link>
          </div>
        )}
        {!hasClerkLock && (
          <Link href={queuePath} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Back to Queue
          </Link>
        )}
      </div>
    );
  }

  // Master acting with no clerk lock — can view and act directly
  if (isMasterActing && lockResult.acquired) {
    return (
      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        You are reviewing this transaction as master. No clerk lock is held.
      </div>
    );
  }

  // Regular clerk — someone else holds the lock
  const { lockedBy } = lockResult as {
    acquired: false;
    lockedBy: { id: string; firstName: string | null; lastName: string | null; username: string | null; lockedAt: Date | null };
  };
  const holderName =
    [lockedBy.firstName, lockedBy.lastName].filter(Boolean).join(" ") || lockedBy.username || "another clerk";
  const lockedAtStr = lockedBy.lockedAt
    ? new Date(lockedBy.lockedAt).toLocaleTimeString()
    : "unknown time";

  return (
    <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 space-y-3">
      <p className="text-sm text-yellow-800">
        This transaction is currently being handled by <strong>{holderName}</strong> since{" "}
        {lockedAtStr}. You can take over if needed.
      </p>
      <div className="flex gap-2">
        <TakeOverDialog transactionId={transactionId} />
        <Link href={queuePath} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Back to Queue
        </Link>
      </div>
    </div>
  );
}
