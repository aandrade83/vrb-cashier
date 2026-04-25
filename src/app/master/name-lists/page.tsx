export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import {
  getAllLockedNames,
  getMethodsWithAvailableSlots,
  getAllMethodsWithListsAndNames,
} from "@/data/name-lists";
import { NameListsView } from "./name-lists-view";

export default async function NameListsPage() {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");

  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");
  if (session.role !== "master_admin") redirect("/master/queue");

  const [lockedNames, methodsForCreate, methodsWithLists] = await Promise.all([
    getAllLockedNames(),
    getMethodsWithAvailableSlots(),
    getAllMethodsWithListsAndNames(),
  ]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="name-lists" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Name Lists</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Method-scoped name pools shared across cashiers, with configurable blocking modes.
            </p>
          </div>
          <NameListsView
            lockedNames={lockedNames}
            methodsForCreate={methodsForCreate}
            methodsWithLists={methodsWithLists}
          />
        </div>
      </main>
    </div>
  );
}
