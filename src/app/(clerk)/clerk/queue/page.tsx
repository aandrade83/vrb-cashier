import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getPendingTransactions,
  getCompletedTransactions,
  getClerkByClerkId,
} from "@/data/queue";
import { VRB_CASHIER_ID } from "@/lib/cashier-context";
import { QueueView } from "./_components/QueueView";

export default async function QueuePage() {
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const [currentClerk, pending, completedDeposits, completedPayouts] =
    await Promise.all([
      getClerkByClerkId(clerkAuthId, VRB_CASHIER_ID),
      getPendingTransactions(VRB_CASHIER_ID),
      getCompletedTransactions(VRB_CASHIER_ID, "deposit", 10),
      getCompletedTransactions(VRB_CASHIER_ID, "payout", 10),
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
