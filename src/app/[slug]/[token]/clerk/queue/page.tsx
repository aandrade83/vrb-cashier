import { redirect } from "next/navigation";
import { getPendingTransactions, getRecentTransactions, getClerkById } from "@/data/queue";
import { QueueView } from "@/app/(clerk)/clerk/queue/_components/QueueView";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getMasterSession } from "@/lib/auth/session";
import { db } from "@/db";
import { masterUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CashierQueuePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const access = await getCashierPageAccess("clerk");
  if (!access) redirect(`/${slug}/${token}/sign-in`);

  const { cashierId, userId, isMasterActing } = access;

  // Determine if the acting master is a master_admin (gate for postconfirmed section)
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

  const [currentClerk, active, completedDeposits, completedPayouts, deniedDeposits, deniedPayouts] =
    await Promise.all([
      userId ? getClerkById(userId, cashierId) : Promise.resolve(null),
      getPendingTransactions(cashierId),
      getRecentTransactions(cashierId, ["completed"], "deposit", 10),
      getRecentTransactions(cashierId, ["completed"], "payout", 10),
      getRecentTransactions(cashierId, ["denied"],    "deposit", 10),
      getRecentTransactions(cashierId, ["denied"],    "payout", 10),
    ]);

  return (
    <QueueView
      active={active}
      completedDeposits={completedDeposits}
      completedPayouts={completedPayouts}
      deniedDeposits={deniedDeposits}
      deniedPayouts={deniedPayouts}
      currentClerkDbId={isMasterActing ? "" : (currentClerk?.id ?? "")}
      isMasterAdmin={isMasterAdmin}
      basePath={`/${slug}/${token}/clerk`}
    />
  );
}
