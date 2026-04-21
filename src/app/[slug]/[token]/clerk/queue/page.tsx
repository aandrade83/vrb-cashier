import { redirect } from "next/navigation";
import {
  getPendingTransactions,
  getCompletedTransactions,
  getClerkById,
} from "@/data/queue";
import { QueueView } from "@/app/(clerk)/clerk/queue/_components/QueueView";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";

export default async function CashierQueuePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const access = await getCashierPageAccess("clerk");
  if (!access) {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { cashierId, userId, isMasterActing } = access;

  const [currentClerk, pending, completedDeposits, completedPayouts] =
    await Promise.all([
      // No real clerk when master is impersonating — pass null for lock operations
      userId ? getClerkById(userId, cashierId) : Promise.resolve(null),
      getPendingTransactions(cashierId),
      getCompletedTransactions(cashierId, "deposit", 10),
      getCompletedTransactions(cashierId, "payout", 10),
    ]);

  return (
    <QueueView
      pending={pending}
      completedDeposits={completedDeposits}
      completedPayouts={completedPayouts}
      currentClerkDbId={isMasterActing ? "" : (currentClerk?.id ?? "")}
      basePath={`/${slug}/${token}/clerk`}
    />
  );
}
