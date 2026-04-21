export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { getCashierById } from "@/data/cashiers";
import { getCashierMethodAssignments } from "@/data/methods";
import { AssignmentTable } from "./assignment-table";

export default async function CashierMethodsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const { id } = await params;
  const cashier = await getCashierById(id);
  if (!cashier) notFound();

  const assignments = await getCashierMethodAssignments(id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="cashiers" />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <Link
              href="/master/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Cashiers
            </Link>
            <h1 className="text-xl font-semibold mt-1">
              {cashier.name} — Methods
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Toggle which global methods this cashier&apos;s admin can use.
            </p>
          </div>
          <AssignmentTable
            cashierId={id}
            assignments={assignments}
            depositsEnabled={cashier.depositsEnabled}
            payoutsEnabled={cashier.payoutsEnabled}
          />
        </div>
      </main>
    </div>
  );
}
