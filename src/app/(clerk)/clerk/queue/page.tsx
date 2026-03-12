import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { getPendingTransactions, getClerkByClerkId } from "@/data/queue";
import { cn } from "@/lib/utils";

export default async function QueuePage() {
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const currentClerk = await getClerkByClerkId(clerkAuthId);
  const transactions = await getPendingTransactions();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Transaction Queue</h1>

      <Card>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">
              No pending transactions. The queue is clear.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Handled By</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isOwnLock = tx.lockedByClerkId === currentClerk?.id;
                  const isOtherLock =
                    tx.lockedByClerkId !== null && !isOwnLock;

                  let actionLabel = "Open";
                  let actionVariant: "default" | "outline" = "default";
                  if (isOwnLock) {
                    actionLabel = "Continue";
                  } else if (isOtherLock) {
                    actionLabel = "Take Over";
                    actionVariant = "outline";
                  }

                  const handledBy = tx.lockedByClerkId
                    ? [tx.lockedByClerkFirstName, tx.lockedByClerkLastName]
                        .filter(Boolean)
                        .join(" ") || "—"
                    : "—";

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">
                        {tx.referenceCode}
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-sm">{tx.methodName}</TableCell>
                      <TableCell className="text-sm">
                        {[tx.playerFirstName, tx.playerLastName]
                          .filter(Boolean)
                          .join(" ") || tx.playerEmail}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {tx.currency} {tx.amount}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            tx.status === "pending" ? "secondary" : "outline"
                          }
                          className="capitalize"
                        >
                          {tx.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {handledBy}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/clerk/queue/${tx.id}`}
                          className={cn(
                            buttonVariants({ variant: actionVariant, size: "sm" })
                          )}
                        >
                          {actionLabel}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
