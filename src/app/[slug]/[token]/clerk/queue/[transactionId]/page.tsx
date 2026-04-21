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

  const [tx, currentClerk] = await Promise.all([
    getTransactionDetail(transactionId, cashierId),
    userId ? getClerkById(userId, cashierId) : Promise.resolve(null),
  ]);

  if (!tx) redirect(`/${slug}/${token}/clerk/queue`);

  // For master: compute lock state from transaction data; never call lockTransactionAction
  // (master has no cashierUsers record to lock with)
  let lockResult: { acquired: true; lockedByClerkId: string } | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; lockedAt: Date | null } };

  if (isMasterActing) {
    if (tx.lockedByClerkId) {
      lockResult = {
        acquired: false,
        lockedBy: {
          id: tx.lockedByClerkId,
          firstName: tx.lockedByClerkFirstName,
          lastName: tx.lockedByClerkLastName,
          lockedAt: tx.lockedAt,
        },
      };
    } else {
      lockResult = {
        acquired: false,
        lockedBy: { id: "", firstName: null, lastName: null, lockedAt: null },
      };
    }
  } else {
    lockResult = await lockTransactionAction(transactionId);
  }

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={isMasterActing ? "" : (currentClerk?.id ?? "")}
      queuePath={`/${slug}/${token}/clerk/queue`}
      isMasterActing={isMasterActing}
    />
  );
}
