export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getMasterTransactionDetail } from "@/data/queue";
import { MasterNav } from "@/components/master-nav";
import { MasterTransactionView } from "./_components/MasterTransactionView";
import { db } from "@/db";
import { cashierUsers, masterUsers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getLockedNameForTransaction } from "@/data/name-lists";

export default async function MasterTransactionDetailPage({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;

  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");
  if (session.role !== "master_admin") redirect("/master/clerk/queue");

  const tx = await getMasterTransactionDetail(transactionId);
  if (!tx) redirect("/master/queue");

  const lockedName = await getLockedNameForTransaction(transactionId);

  // Look up shadow admin row so the view can identify "assigned to me"
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
      <MasterNav active="queue" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <MasterTransactionView transaction={tx} myClerkId={myClerkId} lockedName={lockedName} />
        </div>
      </main>
    </div>
  );
}
