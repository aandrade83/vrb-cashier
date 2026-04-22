import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkById } from "@/data/queue";
import { lockTransactionAction } from "@/app/(clerk)/clerk/queue/actions";
import { TransactionDetailView } from "@/app/(clerk)/clerk/queue/[transactionId]/_components/TransactionDetailView";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getMasterSession } from "@/lib/auth/session";
import { getOrCreateCashierActor } from "@/lib/master-actor";
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

  // Resolve shadow actor for master sessions (used as currentClerkDbId and for lock checks)
  let shadowActorId: string | null = null;
  if (isMasterActing) {
    const shadowActor = await getOrCreateCashierActor(cashierId);
    shadowActorId = shadowActor?.id ?? null;
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
  let initialMasterHasTakenOver = false;

  if (isMasterActing && isMasterAdmin) {
    // master_admin: elevated access — no auto-lock, bypasses lock ownership in actions.
    // Treat lock as "own" when the shadow actor holds it (re-opening a tx they already claimed).
    const isOwnShadowLock = !!tx.lockedByClerkId && tx.lockedByClerkId === shadowActorId;
    if (tx.lockedByClerkId && !isOwnShadowLock) {
      // Another user holds the lock — show Take Over
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
    } else {
      // No lock held, or master's own shadow lock — act immediately
      lockResult = { acquired: true, lockedByClerkId: "" };
      initialMasterHasTakenOver = true;
    }
  } else {
    // Regular clerk OR master_clerk acting via shadow identity — auto-lock on open
    lockResult = await lockTransactionAction(transactionId);
    if (isMasterActing && shadowActorId) {
      initialMasterHasTakenOver = lockResult.acquired && lockResult.lockedByClerkId === shadowActorId;
    }
  }

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={isMasterActing ? (shadowActorId ?? "") : (currentClerk?.id ?? "")}
      queuePath={`/${slug}/${token}/clerk/queue`}
      isMasterActing={isMasterActing}
      isMasterAdmin={isMasterAdmin}
      initialMasterHasTakenOver={initialMasterHasTakenOver}
    />
  );
}
