import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getMethodWithFields } from "@/data/methods";
import { getCashierId } from "@/lib/cashier-context";
import { PayoutForm } from "@/app/(player)/player/payouts/[methodId]/_components/PayoutForm";

export default async function CashierPayoutMethodPage({
  params,
}: {
  params: Promise<{ slug: string; token: string; methodId: string }>;
}) {
  const { sessionClaims } = await auth();

  if (sessionClaims?.public_metadata?.role !== "player") {
    redirect("/");
  }

  const { slug, token, methodId } = await params;
  const cashierId = await getCashierId();
  const base = `/${slug}/${token}/player`;

  const method = await getMethodWithFields(methodId, cashierId);

  if (!method) {
    redirect(`${base}/payouts`);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href={`${base}/payouts`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to Payouts
      </Link>

      <div className="flex items-center gap-4">
        {method.logoUrl ? (
          <Image
            src={method.logoUrl}
            alt={method.name}
            width={56}
            height={56}
            className="rounded object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-2xl">
            💸
          </div>
        )}
        <h1 className="text-2xl font-semibold">{method.name}</h1>
      </div>

      {method.description && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-100">
          {method.description}
        </div>
      )}

      <PayoutForm method={method} fields={method.fields} />
    </div>
  );
}
