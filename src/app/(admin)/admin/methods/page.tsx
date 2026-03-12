import { auth } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { getMethodsForAdmin } from "@/data/methods";
import { TypeFilterTabs } from "./type-filter-tabs";
import { MethodsTable } from "./methods-table";

export default async function MethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await auth();

  const { type } = await searchParams;
  const validType: "deposit" | "payout" =
    type === "payout" ? "payout" : "deposit";

  const methods = await getMethodsForAdmin(validType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Payment Methods</h1>
        <Link href="/admin/methods/new" className={buttonVariants()}>
          Create Method
        </Link>
      </div>
      <TypeFilterTabs currentType={validType} />
      <Card>
        <CardContent className="p-0">
          <MethodsTable methods={methods} />
        </CardContent>
      </Card>
    </div>
  );
}
