import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkById } from "@/data/queue";
import { lockTransactionAction } from "@/app/(clerk)/clerk/queue/actions";
import { TransactionDetailView } from "@/app/(clerk)/clerk/queue/[transactionId]/_components/TransactionDetailView";
import { getUserSession } from "@/lib/auth/session";

export default async function CashierTransactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; transactionId: string }>;
}) {
  const { transactionId, slug, token } = await params;
  const session = await getUserSession();

  if (!session || session.role !== "clerk") {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { userId, cashierId } = session;

  const [tx, currentClerk, lockResult] = await Promise.all([
    getTransactionDetail(transactionId, cashierId),
    getClerkById(userId, cashierId),
    lockTransactionAction(transactionId),
  ]);

  if (!tx) redirect(`/${slug}/${token}/clerk/queue`);

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={currentClerk?.id ?? ""}
    />
  );
}
