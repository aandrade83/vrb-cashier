import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPendingTransactions, getCompletedTransactions } from "@/data/queue";
import { getCashierId } from "@/lib/cashier-context";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export default async function CashierAdminClerksPage() {
  const cashierId = await getCashierId();

  const [pending, completedDeposits, completedPayouts] = await Promise.all([
    getPendingTransactions(cashierId),
    getCompletedTransactions(cashierId, "deposit", 10),
    getCompletedTransactions(cashierId, "payout", 10),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Clerk Queue View</h1>
      <p className="text-sm text-muted-foreground">
        Read-only view of the clerk transaction queue.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending &amp; In Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="text-center text-muted-foreground py-12 text-sm">No pending transactions.</p>
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
                  <TableHead>Lock Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((tx) => {
                  const handledBy = tx.lockedByClerkId
                    ? [tx.lockedByClerkFirstName, tx.lockedByClerkLastName].filter(Boolean).join(" ") || "—"
                    : "—";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tx.type === "deposit" ? "border-green-500 text-green-700" : "border-orange-500 text-orange-700"}>
                          {tx.type === "deposit" ? "Deposit" : "Payout"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{tx.methodName}</TableCell>
                      <TableCell className="text-sm">
                        {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(tx.createdAt, { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize">
                          {tx.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{handledBy}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {tx.lockExpiresAt ? format(tx.lockExpiresAt, "HH:mm") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 10 Completed Deposits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {completedDeposits.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No completed deposits.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedDeposits.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(tx.createdAt, "do MMM yyyy")}</TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 10 Completed Payouts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {completedPayouts.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No completed payouts.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Player Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedPayouts.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-sm">{tx.referenceCode}</TableCell>
                    <TableCell className="text-sm">{tx.methodName}</TableCell>
                    <TableCell className="text-sm">
                      {[tx.playerFirstName, tx.playerLastName].filter(Boolean).join(" ") || tx.playerEmail}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.currency} {tx.amount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(tx.createdAt, "do MMM yyyy")}</TableCell>
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
