import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkById } from "@/data/queue";
import { lockTransactionAction } from "@/app/(clerk)/clerk/queue/actions";
import { TransactionDetailView } from "@/app/(clerk)/clerk/queue/[transactionId]/_components/TransactionDetailView";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getMasterSession } from "@/lib/auth/session";
import { db } from "@/db";
import { masterUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CashierTransactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; transactionId: string }>;
}) {
  const { transactionId, slug, token } = await params;

  const access = await getCashierPageAccess("clerk");
  if (!access) redirect(`/${slug}/${token}/sign-in`);

  const { userId, cashierId, isMasterActing } = access;

  // Resolve master_admin status for UI gates
  let isMasterAdmin = false;
  if (isMasterActing) {
    const masterSession = await getMasterSession();
    if (masterSession) {
      if (!masterSession.masterUserId) {
        isMasterAdmin = true; // ENV root = always master_admin
      } else {
        const [mu] = await db
          .select({ role: masterUsers.role })
          .from(masterUsers)
          .where(eq(masterUsers.id, masterSession.masterUserId))
          .limit(1);
        isMasterAdmin = mu?.role === "master_admin";
      }
    }
  }

  const [tx, currentClerk] = await Promise.all([
    getTransactionDetail(transactionId, cashierId),
    userId ? getClerkById(userId, cashierId) : Promise.resolve(null),
  ]);

  if (!tx) redirect(`/${slug}/${token}/clerk/queue`);

  type LockResult =
    | { acquired: true; lockedByClerkId: string }
    | { acquired: false; lockedBy: { id: string; firstName: string | null; lastName: string | null; username: string | null; lockedAt: Date | null } };

  let lockResult: LockResult;
  const initialMasterHasTakenOver = false;

  if (isMasterActing) {
    if (tx.lockedByClerkId) {
      // A real clerk holds the lock — master must Take Over
      lockResult = {
        acquired: false,
        lockedBy: {
          id: tx.lockedByClerkId,
          firstName: tx.lockedByClerkFirstName,
          lastName: tx.lockedByClerkLastName,
          username: tx.lockedByClerkUsername ?? null,
          lockedAt: tx.lockedAt,
        },
      };
    } else if (tx.status === "unassigned") {
      // Truly unassigned — show Take Over
      lockResult = { acquired: false, lockedBy: { id: "", firstName: null, lastName: null, username: null, lockedAt: null } };
    } else {
      // No clerk lock, status is active — master can view/act
      lockResult = { acquired: true, lockedByClerkId: "" };
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
      isMasterAdmin={isMasterAdmin}
      initialMasterHasTakenOver={initialMasterHasTakenOver}
    />
  );
}
