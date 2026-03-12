import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { format } from "date-fns";
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
import { getPlayerByClerkId } from "@/data/transactions";
import { getPlayerTransactions } from "@/data/transactions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export default async function PlayerTransactionsPage() {
  const { sessionClaims, userId: clerkId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "player" || !clerkId) {
    redirect("/");
  }

  const player = await getPlayerByClerkId(clerkId);
  const txList = player ? await getPlayerTransactions(player.id) : [];

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-semibold">Transactions</h1>

      <Card>
        <CardContent className="p-0">
          {txList.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No transactions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txList.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">
                      {format(tx.createdAt, "do MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {tx.currency} {tx.amount}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize">
                        {tx.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
