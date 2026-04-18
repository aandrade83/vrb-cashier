import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlayerDashboardPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const session = await getUserSession();

  if (!session || session.role !== "player") {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const base = `/${slug}/${token}/player`;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href={`${base}/deposits`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Deposits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Submit a deposit request.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`${base}/payouts`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Submit a payout request.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`${base}/transactions`}>
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">View your transaction history.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
