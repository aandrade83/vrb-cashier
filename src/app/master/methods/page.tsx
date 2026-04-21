export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { getGlobalMethodsWithFieldCount } from "@/data/methods";
import { MethodsTable } from "./methods-table";
import { buttonVariants } from "@/lib/button-variants";

export default async function MasterMethodsPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const methods = await getGlobalMethodsWithFieldCount();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="methods" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Global Methods ({methods.length})</h1>
            <Link href="/master/methods/new" className={buttonVariants({ size: "sm" })}>
              New Method
            </Link>
          </div>
          <MethodsTable methods={methods} />
        </div>
      </main>
    </div>
  );
}
