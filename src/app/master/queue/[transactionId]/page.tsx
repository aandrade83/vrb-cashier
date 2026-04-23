export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { getMasterTransactionDetail } from "@/data/queue";
import { MasterNav } from "@/components/master-nav";
import { MasterTransactionView } from "./_components/MasterTransactionView";

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="queue" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto">
          <MasterTransactionView transaction={tx} />
        </div>
      </main>
    </div>
  );
}
