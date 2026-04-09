import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getTransactionDetail, getClerkByClerkId } from "@/data/queue";
import { getCashierId } from "@/lib/cashier-context";
import { lockTransactionAction } from "@/app/(clerk)/clerk/queue/actions";
import { TransactionDetailView } from "@/app/(clerk)/clerk/queue/[transactionId]/_components/TransactionDetailView";

export default async function CashierTransactionDetailPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; transactionId: string }>;
}) {
  const { transactionId, slug, token } = await params;
  const { sessionClaims, userId: clerkAuthId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "clerk" || !clerkAuthId) {
    redirect("/");
  }

  const cashierId = await getCashierId();

  const [tx, currentClerk, lockResult] = await Promise.all([
    getTransactionDetail(transactionId, cashierId),
    getClerkByClerkId(clerkAuthId, cashierId),
    lockTransactionAction(transactionId),
  ]);

  if (!tx) redirect(`/${slug}/${token}/clerk/queue`);

  return (
    <TransactionDetailView
      transaction={tx}
      lockResult={lockResult}
      currentClerkDbId={currentClerk?.id ?? ""}
    />
  );
}
