export const dynamic = "force-dynamic";

import { getAllCashiers, getCashiersByIds } from "@/data/cashiers";
import {
  getMasterSessionData,
  getMasterSessionFromCookies,
} from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { MasterNav } from "@/components/master-nav";
import { CashierCard } from "./cashier-card";
import type { Cashier } from "@/db/schema";

export default async function MasterDashboardPage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");
  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  if (session.role === "master_clerk") redirect("/master/clerk/dashboard");

  // ENV root sees everything; DB admin sees only permitted cashiers (no fallback)
  let allCashiers: Cashier[];
  let noAccess = false;
  if (session.isEnvRoot || !session.masterUserId) {
    allCashiers = await getAllCashiers();
  } else {
    const permittedIds = await getUserCashierPermissions(session.masterUserId);
    if (permittedIds.length === 0) {
      allCashiers = [];
      noAccess = true;
    } else {
      allCashiers = await getCashiersByIds(permittedIds);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="cashiers" />

      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Cashiers</h1>
            <Link
              href="/master/cashiers/new"
              className={buttonVariants({ size: "sm" })}
            >
              New Cashier
            </Link>
          </div>

          {noAccess ? (
            <div className="text-center py-12 text-muted-foreground">
              You don&apos;t have access to any cashier. Please verify
              permissions with Administration.
            </div>
          ) : allCashiers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No cashiers yet. Create the first one.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allCashiers.map((cashier) => (
                <CashierCard
                  key={cashier.id}
                  cashier={cashier}
                  isEnvRoot={session.isEnvRoot}
                  otherCashiers={allCashiers
                    .filter((c) => c.id !== cashier.id)
                    .map((c) => ({ id: c.id, name: c.name }))}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
