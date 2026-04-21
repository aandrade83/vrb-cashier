import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkById } from "@/data/queue";
import { lockTransactionAction } from "@/app/(clerk)/clerk/queue/actions";
import { TransactionDetailView } from "@/app/(clerk)/clerk/queue/[transactionId]/_components/TransactionDetailView";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";

export default async function CashierTransactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; transactionId: string }>;
}) {
  const { transactionId, slug, token } = await params;

  const access = await getCashierPageAccess("clerk");
  if (!access) {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { userId, cashierId, isMasterActing } = access;

  // Master acting: skip DB lock acquisition — master always owns the session
  const masterLockResult = { acquired: true as const, lockedByClerkId: "" };

  const [tx, currentClerk, lockResult] = await Promise.all([
    getTransactionDetail(transactionId, cashierId),
    userId ? getClerkById(userId, cashierId) : Promise.resolve(null),
    isMasterActing ? Promise.resolve(masterLockResult) : lockTransactionAction(transactionId),
  ]);

  if (!tx) redirect(`/${slug}/${token}/clerk/queue`);

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={isMasterActing ? "" : (currentClerk?.id ?? "")}
      queuePath={`/${slug}/${token}/clerk/queue`}
    />
  );
}
