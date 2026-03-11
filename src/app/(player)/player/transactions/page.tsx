import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlayerTransactionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No transactions yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
