export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { getAllCashiers } from "@/data/cashiers";
import { getAllNamesForCashier } from "@/data/names-pool";
import { NamesTable } from "./names-table";
import { AddNamesForm } from "./add-names-form";
import { CashierPoolSelector } from "@/components/cashier-pool-selector";

export default async function MasterNamesPage({
  searchParams,
}: {
  searchParams: Promise<{ cashier?: string }>;
}) {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const { cashier: cashierId } = await searchParams;
  const allCashiers = await getAllCashiers();

  const selectedCashier = cashierId
    ? allCashiers.find((c) => c.id === cashierId) ?? allCashiers[0]
    : allCashiers[0];

  const rows = selectedCashier ? await getAllNamesForCashier(selectedCashier.id) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="names" />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Names Pool</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Names are auto-assigned to transactions for anonymization. Lower priority number = assigned first.
              </p>
            </div>
            {allCashiers.length > 1 && (
              <CashierPoolSelector
                cashiers={allCashiers.map((c) => ({ id: c.id, name: c.name }))}
                selectedId={selectedCashier?.id ?? null}
                basePath="/master/names"
              />
            )}
          </div>

          {!selectedCashier ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No cashiers exist yet.
            </p>
          ) : (
            <>
              <AddNamesForm cashierId={selectedCashier.id} />
              <div className="rounded-md border">
                <NamesTable rows={rows} cashierId={selectedCashier.id} />
              </div>
              <p className="text-xs text-muted-foreground">
                {rows.length} name{rows.length !== 1 ? "s" : ""} in pool
                {" · "}{rows.filter((r) => !r.isLocked && r.isActive).length} available
                {" · "}{rows.filter((r) => r.isLocked).length} locked
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
