import { notFound, redirect } from "next/navigation";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { getGlobalMethodById } from "@/data/methods";
import { EditMethodForm } from "@/app/(admin)/admin/methods/[id]/edit/edit-method-form";
import { updateGlobalMethodAction } from "../../actions";
import { hasNameListForMethod } from "@/data/name-lists";

export default async function EditGlobalMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const { id } = await params;
  const [method, hasList] = await Promise.all([
    getGlobalMethodById(id),
    hasNameListForMethod(id),
  ]);
  if (!method) notFound();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="methods" />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-xl font-semibold">Edit Method — {method.name}</h1>
          <EditMethodForm
            method={method}
            updateAction={updateGlobalMethodAction}
            successRedirect="/master/methods"
            hasNameList={hasList}
          />
        </div>
      </main>
    </div>
  );
}
