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
import { getPlayerById, getPlayerTransactions } from "@/data/transactions";
import { STATUS_LABELS } from "@/data/admin-transactions";
import { getUserSession } from "@/lib/auth/session";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export default async function CashierTransactionsPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const session = await getUserSession();

  if (!session || session.role !== "player") {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { userId, cashierId } = session;

  const player = await getPlayerById(userId, cashierId);
  const txList = player ? await getPlayerTransactions(player.id, cashierId) : [];

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
                        {STATUS_LABELS[tx.status] ?? tx.status.replace("_", " ")}
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
