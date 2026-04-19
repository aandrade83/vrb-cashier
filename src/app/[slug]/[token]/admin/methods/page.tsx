import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { getMethodsForAdmin } from "@/data/methods";
import { getCashierId } from "@/lib/cashier-context";
import { TypeFilterTabs } from "@/app/(admin)/admin/methods/type-filter-tabs";
import { MethodsTable } from "@/app/(admin)/admin/methods/methods-table";

export default async function CashierMethodsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { slug, token } = await params;
  const { type } = await searchParams;
  const cashierId = await getCashierId();

  const validType: "deposit" | "payout" =
    type === "payout" ? "payout" : "deposit";

  const methods = await getMethodsForAdmin(cashierId, validType);
  const base = `/${slug}/${token}/admin`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payment Methods</h1>
        <Link href={`${base}/methods/new`} className={buttonVariants()}>
          Create Method
        </Link>
      </div>
      <TypeFilterTabs currentType={validType} />
      <Card>
        <CardContent className="p-0">
          <MethodsTable methods={methods} base={base} />
        </CardContent>
      </Card>
    </div>
  );
}
