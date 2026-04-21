export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getMasterSessionData, getMasterSessionFromCookies } from "@/lib/master-auth";
import { MasterNav } from "@/components/master-nav";
import { db } from "@/db";
import { masterUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllCashiersWithPermissionStatus } from "@/data/master-users";
import { PermissionsTable } from "./permissions-table";

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = await getMasterSessionFromCookies();
  if (!token) redirect("/master/login");
  const session = await getMasterSessionData(token);
  if (!session) redirect("/master/login");

  const { id } = await params;

  const [user] = await db
    .select({ id: masterUsers.id, username: masterUsers.username, role: masterUsers.role })
    .from(masterUsers)
    .where(eq(masterUsers.id, id))
    .limit(1);

  if (!user) notFound();

  // master_admin can only manage master_clerk permissions; ENV root can manage anyone
  if (!session.isEnvRoot && session.role !== "master_admin") redirect("/master/users");
  if (!session.isEnvRoot && user.role === "master_admin") redirect("/master/users");

  const rows = await getAllCashiersWithPermissionStatus(id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MasterNav active="users" />
      <main className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <Link
              href="/master/users"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Users
            </Link>
            <h1 className="text-xl font-semibold mt-1">
              {user.username} — Cashier Access
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Toggle which cashiers this user can access.
            </p>
          </div>
          <PermissionsTable masterUserId={id} rows={rows} />
        </div>
      </main>
    </div>
  );
}
