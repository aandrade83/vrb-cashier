import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ClerkReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No reports available.</p>
        </CardContent>
      </Card>
    </div>
  );
}
