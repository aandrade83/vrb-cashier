export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getMasterSessionData,
  getMasterSessionFromCookies,
  isMasterAuthenticated,
} from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { getAllMasterUsers } from "@/data/master-users";
import { MasterUsersTable } from "./users-table";
import { buttonVariants } from "@/lib/button-variants";

export default async function MasterUsersPage() {
  const authenticated = await isMasterAuthenticated();
  if (!authenticated) redirect("/master/login");

  const token = await getMasterSessionFromCookies();
  const session = token ? await getMasterSessionData(token) : null;

  const users = await getAllMasterUsers();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="users" />
      <main className="flex-1 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">
              Master Users ({users.length})
            </h1>
            {session?.role === "master_admin" && (
              <Link href="/master/users/new" className={buttonVariants({ size: "sm" })}>
                New User
              </Link>
            )}
          </div>
          <MasterUsersTable
            users={users}
            currentUserId={session?.masterUserId ?? null}
            currentUserIsEnvRoot={session?.isEnvRoot ?? false}
            currentUserRole={session?.role ?? null}
          />
        </div>
      </main>
    </div>
  );
}
