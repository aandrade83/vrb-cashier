import { getAllCashiers } from "@/data/cashiers";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { MasterLogoutButton } from "./logout-button";

export default async function MasterDashboardPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const allCashiers = await getAllCashiers();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Master Dashboard</h1>
            <p className="text-muted-foreground text-sm">VRB Cashier — Multi-tenant control panel</p>
          </div>
          <MasterLogoutButton />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cashiers ({allCashiers.length})</h2>
          <Link href="/master/cashiers/new" className={buttonVariants({ size: "sm" })}>
            New Cashier
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allCashiers.map((cashier) => (
            <Card key={cashier.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{cashier.name}</CardTitle>
                  <Badge variant={cashier.isActive ? "default" : "secondary"}>
                    {cashier.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug</span>
                  <code className="font-mono">{cashier.slug}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token</span>
                  <code className="font-mono">{cashier.token}</code>
                </div>
                {cashier.contactEmail && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{cashier.contactEmail}</span>
                  </div>
                )}
                <div className="pt-2">
                  <p className="text-muted-foreground text-xs break-all">
                    URL: /{cashier.slug}/{cashier.token}/admin/dashboard
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {allCashiers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No cashiers yet. Create the first one.
          </div>
        )}
      </div>
    </div>
  );
}
