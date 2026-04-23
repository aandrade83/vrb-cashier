export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getUserCashierPermissions } from "@/data/master-users";
import { getMasterTransactionDetail } from "@/data/queue";
import { MasterClerkNav } from "@/components/master-clerk-nav";
import { ClerkTransactionView } from "./_components/ClerkTransactionView";
import { db } from "@/db";
import { cashierUsers, masterUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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

  // Look up the shadow clerk row for this master user so the view can hide
  // the Take Over button when the transaction is already assigned to them.
  let myClerkId: string | null = null;
  if (session.masterUserId) {
    const [mu] = await db
      .select({ username: masterUsers.username })
      .from(masterUsers)
      .where(eq(masterUsers.id, session.masterUserId))
      .limit(1);
    if (mu) {
      const [shadow] = await db
        .select({ id: cashierUsers.id })
        .from(cashierUsers)
        .where(and(
          eq(cashierUsers.cashierId, tx.cashierId),
          eq(cashierUsers.username, `__m__${mu.username}`),
        ))
        .limit(1);
      myClerkId = shadow?.id ?? null;
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterClerkNav active="queue" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <ClerkTransactionView transaction={tx} myClerkId={myClerkId} />
        </div>
      </main>
    </div>
  );
}
