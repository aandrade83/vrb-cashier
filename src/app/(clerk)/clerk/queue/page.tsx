import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getPendingTransactions,
  getCompletedTransactions,
  getClerkByClerkId,
} from "@/data/queue";
import { QueueView } from "./_components/QueueView";

export default async function QueuePage() {
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const [currentClerk, pending, completedDeposits, completedPayouts] =
    await Promise.all([
      getClerkByClerkId(clerkAuthId),
      getPendingTransactions(),
      getCompletedTransactions("deposit", 10),
      getCompletedTransactions("payout", 10),
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
