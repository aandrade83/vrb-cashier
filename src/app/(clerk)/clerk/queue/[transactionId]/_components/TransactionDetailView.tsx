"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import type { TransactionDetail } from "@/data/queue";
import { LockBanner } from "./LockBanner";
import { UpdateForm } from "./UpdateForm";

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
  transaction: TransactionDetail;
  lockResult: LockResult;
  currentClerkDbId: string;
}

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export function TransactionDetailView({
  transaction: tx,
  lockResult,
  currentClerkDbId,
}: Props) {
  const ownsLock =
    lockResult.acquired && lockResult.lockedByClerkId === currentClerkDbId;

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/clerk/queue"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        ← Back to Queue
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Left column: transaction info ── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Header */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-semibold">
                  {tx.referenceCode}
                </span>
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
                <Badge
                  variant={STATUS_VARIANT[tx.status] ?? "secondary"}
                  className="capitalize"
                >
                  {tx.status.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Player
                  </p>
                  <p>
                    {[tx.playerFirstName, tx.playerLastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </p>
                  <p className="text-muted-foreground">{tx.playerEmail}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide mb-0.5">
                    Method
                  </p>
                  <p>{tx.methodName}</p>
                  <p className="text-muted-foreground capitalize">
                    {tx.methodType}
                  </p>
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
              </div>
            </CardContent>
          </Card>

          {/* Form submission fields */}
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
                    {fv.fieldTypeSnapshot === "image" ||
                    fv.fieldTypeSnapshot === "file" ? (
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

          {/* Attachments */}
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
                    <span className="text-muted-foreground ml-2 text-xs">
                      {att.fileType}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Update history */}
          {tx.updates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {tx.updates.map((upd, i) => (
                  <div key={upd.id}>
                    {i > 0 && <Separator className="mb-4" />}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          {format(upd.createdAt, "do MMM yyyy, HH:mm")} ·{" "}
                          {[upd.clerkFirstName, upd.clerkLastName]
                            .filter(Boolean)
                            .join(" ") || "Unknown clerk"}
                        </p>
                        <p className="capitalize">
                          <span className="text-muted-foreground">
                            {upd.previousStatus.replace("_", " ")}
                          </span>
                          {" → "}
                          <strong>{upd.newStatus.replace("_", " ")}</strong>
                        </p>
                        {upd.noteToPlayer && (
                          <p className="text-muted-foreground">
                            {upd.noteToPlayer}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column: clerk action panel ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lock Status</CardTitle>
            </CardHeader>
            <CardContent>
              <LockBanner
                lockResult={lockResult}
                transactionId={tx.id}
                currentClerkDbId={currentClerkDbId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update Transaction</CardTitle>
            </CardHeader>
            <CardContent>
              <UpdateForm transactionId={tx.id} ownsLock={ownsLock} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
