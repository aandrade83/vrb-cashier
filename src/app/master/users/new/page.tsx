import { redirect } from "next/navigation";
import {
  getMasterSessionData,
  getMasterSessionFromCookies,
  isMasterAuthenticated,
} from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { CreateMasterUserForm } from "./create-master-user-form";

export default async function NewMasterUserPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const token = await getMasterSessionFromCookies();
  const session = token ? await getMasterSessionData(token) : null;
  if (session?.role !== "master_admin") redirect("/master/users");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="users" />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className="text-xl font-semibold">New Master User</h1>
          <CreateMasterUserForm />
        </div>
      </main>
    </div>
  );
}
