import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function QueuePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Transaction Queue</h1>
      <Card>
        <CardHeader>
          <CardTitle>Pending Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No pending transactions.</p>
        </CardContent>
      </Card>
    </div>
  );
}
