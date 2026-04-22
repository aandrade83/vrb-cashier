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
import { TX_STATUS_BADGE_VARIANT } from "@/lib/transaction-statuses";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";

export default async function CashierTransactionsPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const access = await getCashierPageAccess("player");

  if (!access) {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { userId, cashierId } = access;

  const player = userId ? await getPlayerById(userId, cashierId) : null;
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
                      <Badge variant={TX_STATUS_BADGE_VARIANT[tx.status as keyof typeof TX_STATUS_BADGE_VARIANT] ?? "secondary"} className="capitalize">
                        {STATUS_LABELS[tx.status] ?? tx.status}
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
