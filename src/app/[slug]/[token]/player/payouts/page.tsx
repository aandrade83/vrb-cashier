import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getActivePayoutMethods } from "@/data/methods";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { getCashier } from "@/lib/cashier-context";

export default async function CashierPayoutsPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const [access, cashier] = await Promise.all([
    getCashierPageAccess("player"),
    getCashier(),
  ]);

  if (!access) redirect(`/${slug}/${token}/sign-in`);
  if (!cashier.payoutsEnabled) redirect(`/${slug}/${token}/player/dashboard`);

  const { cashierId } = access;
  const base = `/${slug}/${token}/player`;

  const methods = await getActivePayoutMethods(cashierId);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-semibold">Payouts</h1>

      {methods.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No payout methods are currently available. Please check back later.
        </p>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <Link
              key={method.id}
              href={`${base}/payouts/${method.id}`}
              className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="shrink-0">
                {method.logoUrl ? (
                  <Image
                    src={method.logoUrl}
                    alt={method.name}
                    width={48}
                    height={48}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-muted-foreground text-xl">
                    💸
                  </div>
                )}
              </div>
              <span className="flex-1 font-medium">{method.name}</span>
              <span className="text-muted-foreground">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
