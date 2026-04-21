import { redirect } from "next/navigation";
import { isMasterAuthenticated } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { CreateMethodForm } from "@/app/(admin)/admin/methods/new/create-method-form";
import { createGlobalMethodAction } from "../actions";

export default async function NewGlobalMethodPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="methods" />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-xl font-semibold">New Global Method</h1>
          <CreateMethodForm
            saveAction={createGlobalMethodAction}
            successRedirect="/master/methods"
          />
        </div>
      </main>
    </div>
  );
}
