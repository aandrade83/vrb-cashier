import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveDepositMethods } from "@/data/methods";
import { getPlayerByClerkId, getPlayerTransactions } from "@/data/transactions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  in_progress: "outline",
  approved: "default",
  rejected: "destructive",
  completed: "default",
  cancelled: "destructive",
};

export default async function DepositsPage() {
  const { sessionClaims, userId: clerkId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "player" || !clerkId) {
    redirect("/");
  }

  const [methods, player] = await Promise.all([
    getActiveDepositMethods(),
    getPlayerByClerkId(clerkId),
  ]);

  const recentTx = player ? (await getPlayerTransactions(player.id)).slice(0, 5) : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Deposits</h1>

      {/* Method cards */}
      {methods.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No deposit methods are currently available. Please check back later.
        </p>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <Link
              key={method.id}
              href={`/player/deposits/${method.id}`}
              className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0">
                {method.logoUrl ? (
                  <Image
                    src={method.logoUrl}
                    alt={method.name}
                    width={48}
                    height={48}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xl">
                    💳
                  </div>
                )}
              </div>
              <span className="flex-1 font-medium">{method.name}</span>
              <span className="text-muted-foreground">→</span>
            </Link>
          ))}
        </div>
      )}

      {/* Recent transactions summary */}
      {recentTx.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/player/transactions" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {recentTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-sm">
                <div className="space-y-0.5">
                  <p className="font-medium">{tx.methodName}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(tx.createdAt, "do MMM yyyy")} · <span className="capitalize">{tx.type}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{tx.currency} {tx.amount}</span>
                  <Badge variant={STATUS_VARIANT[tx.status] ?? "secondary"} className="capitalize text-xs">
                    {tx.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
