export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { getCashiersByIds } from "@/data/cashiers";
import { getPendingTransactionsMulti, getCompletedTransactionsMulti } from "@/data/queue";
import { MasterClerkNav } from "@/components/master-clerk-nav";
import { ClerkQueueView } from "./clerk-queue-view";

export default async function ClerkQueuePage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  if (session.role === "master_admin") redirect("/master/dashboard");

  const cashierIds = session.masterUserId
    ? await getUserCashierPermissions(session.masterUserId)
    : [];

  const [cashiers, pending, completed] = await Promise.all([
    getCashiersByIds(cashierIds),
    getPendingTransactionsMulti(cashierIds),
    getCompletedTransactionsMulti(cashierIds, 40),
  ]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="queue" />

      <main className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          <ClerkQueueView
            pending={pending}
            completed={completed}
            cashiers={cashiers.map((c) => ({ id: c.id, name: c.name }))}
          />
        </div>
      </main>
    </div>
  );
}
