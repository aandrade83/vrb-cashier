import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function CashierAdminDashboardPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/admin`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href={`${base}/users`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle>Users</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Manage players, clerks, and admins.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`${base}/methods`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle>Methods</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">Manage deposit and payout payment methods.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`${base}/deposits`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle>Deposits</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">View and manage deposit transactions.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`${base}/payouts`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader><CardTitle>Payouts</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">View and manage payout transactions.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
