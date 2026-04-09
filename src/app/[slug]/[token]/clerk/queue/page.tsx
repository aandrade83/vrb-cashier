import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getPendingTransactions,
  getCompletedTransactions,
  getClerkByClerkId,
} from "@/data/queue";
import { getCashierId } from "@/lib/cashier-context";
import { QueueView } from "@/app/(clerk)/clerk/queue/_components/QueueView";

export default async function CashierQueuePage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const cashierId = await getCashierId();

  const [currentClerk, pending, completedDeposits, completedPayouts] =
    await Promise.all([
      getClerkByClerkId(clerkAuthId, cashierId),
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
