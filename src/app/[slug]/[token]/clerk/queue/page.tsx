import { redirect } from "next/navigation";
import {
  getPendingTransactions,
  getCompletedTransactions,
  getClerkById,
} from "@/data/queue";
import { QueueView } from "@/app/(clerk)/clerk/queue/_components/QueueView";
import { getUserSession } from "@/lib/auth/session";

export default async function CashierQueuePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const session = await getUserSession();

  if (!session || session.role !== "clerk") {
    redirect(`/${slug}/${token}/sign-in`);
  }

  const { userId, cashierId } = session;

  const [currentClerk, pending, completedDeposits, completedPayouts] =
    await Promise.all([
      getClerkById(userId, cashierId),
      getPendingTransactions(cashierId),
      getCompletedTransactions(cashierId, "deposit", 10),
      getCompletedTransactions(cashierId, "payout", 10),
    ]);

  return (
    <QueueView
      pending={pending}
      completedDeposits={completedDeposits}
      completedPayouts={completedPayouts}
      currentClerkDbId={currentClerk?.id ?? ""}
    />
  );
}
