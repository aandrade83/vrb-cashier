import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PayoutsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Payouts</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No payouts yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
