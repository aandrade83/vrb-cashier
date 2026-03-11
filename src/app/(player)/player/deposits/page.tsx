import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DepositsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Deposits</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Deposits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No deposits yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
