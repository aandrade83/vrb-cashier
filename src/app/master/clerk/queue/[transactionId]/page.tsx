export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { getMasterTransactionDetail } from "@/data/queue";
import { MasterClerkNav } from "@/components/master-clerk-nav";
import { ClerkTransactionView } from "./_components/ClerkTransactionView";

export default async function ClerkTransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;

  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");
  if (session.role !== "master_clerk") redirect("/master/clerk/queue");

  const tx = await getMasterTransactionDetail(transactionId);
  if (!tx) redirect("/master/clerk/queue");

  if (session.masterUserId) {
    const permittedIds = await getUserCashierPermissions(session.masterUserId);
    if (!permittedIds.includes(tx.cashierId)) redirect("/master/clerk/queue");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="queue" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <ClerkTransactionView transaction={tx} />
        </div>
      </main>
    </div>
  );
}
