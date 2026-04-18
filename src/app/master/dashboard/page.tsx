import { getAllCashiers } from "@/data/cashiers";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { MasterLogoutButton } from "./logout-button";
import { CashierCard } from "./cashier-card";

export default async function MasterDashboardPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const allCashiers = await getAllCashiers();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top navbar */}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="font-bold text-sm">Cashier Master</span>
          <nav className="flex gap-6">
            <Link
              href="/master/dashboard"
              className="text-sm font-medium text-primary border-b-2 border-primary pb-0.5"
            >
              Cashiers
            </Link>
            <Link
              href="/master/reports"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Reports
            </Link>
          </nav>
        </div>
        <MasterLogoutButton />
      </header>

      {/* Page content */}
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              Cashiers ({allCashiers.length})
            </h1>
            <Link href="/master/cashiers/new" className={buttonVariants({ size: "sm" })}>
              New Cashier
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allCashiers.map((cashier) => (
              <CashierCard key={cashier.id} cashier={cashier} />
            ))}
          </div>

          {allCashiers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No cashiers yet. Create the first one.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
