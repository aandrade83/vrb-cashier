export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getAllCashiers, getCashiersByIds } from "@/data/cashiers";
import { getUserCashierPermissions } from "@/data/master-users";
import { getPendingTransactionsMulti, getCompletedTransactionsMulti } from "@/data/queue";
import { MasterNav } from "@/components/master-nav";
import { ClerkQueueView } from "@/app/master/clerk/queue/clerk-queue-view";
import type { Cashier } from "@/db/schema";

export default async function MasterQueuePage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  if (session.role === "master_clerk") redirect("/master/clerk/queue");

  let cashierList: Cashier[];
  if (session.isEnvRoot || !session.masterUserId) {
    cashierList = await getAllCashiers();
  } else {
    const permittedIds = await getUserCashierPermissions(session.masterUserId);
    cashierList = permittedIds.length > 0 ? await getCashiersByIds(permittedIds) : [];
  }

  const cashierIds = cashierList.map((c) => c.id);

  const [pending, completed] = await Promise.all([
    cashierIds.length > 0 ? getPendingTransactionsMulti(cashierIds) : Promise.resolve([]),
    cashierIds.length > 0 ? getCompletedTransactionsMulti(cashierIds, 40) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="queue" />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <ClerkQueueView
            pending={pending}
            completed={completed}
            cashiers={cashierList.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </main>
    </div>
  );
}
