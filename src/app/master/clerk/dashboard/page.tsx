export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { getCashiersByIds } from "@/data/cashiers";
import { MasterClerkNav } from "@/components/master-clerk-nav";
import { ClerkCashierCard } from "./clerk-cashier-card";

export default async function ClerkDashboardPage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  if (session.role === "master_admin") redirect("/master/dashboard");

  const cashierIds = session.masterUserId
    ? await getUserCashierPermissions(session.masterUserId)
    : [];

  const permittedCashiers = await getCashiersByIds(cashierIds);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="cashiers" />

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <h1 className="text-xl font-semibold">
            Cashiers ({permittedCashiers.length})
          </h1>

          {permittedCashiers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No cashiers assigned to your account. Contact an admin.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {permittedCashiers.map((cashier) => (
                <ClerkCashierCard key={cashier.id} cashier={cashier} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
