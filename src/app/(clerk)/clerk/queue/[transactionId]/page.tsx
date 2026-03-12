import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkByClerkId } from "@/data/queue";
import { lockTransactionAction } from "../actions";
import { TransactionDetailView } from "./_components/TransactionDetailView";

interface Props {
  params: Promise<{ transactionId: string }>;
}

export default async function TransactionDetailPage({ params }: Props) {
  const { transactionId } = await params;
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const [tx, currentClerk, lockResult] = await Promise.all([
    getTransactionDetail(transactionId),
    getClerkByClerkId(clerkAuthId),
    lockTransactionAction(transactionId),
  ]);

  if (!tx) redirect("/clerk/queue");

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={currentClerk?.id ?? ""}
    />
  );
}
