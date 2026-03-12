import { auth } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { getUsersForAdmin } from "@/data/users";
import { RoleFilterTabs } from "./role-filter-tabs";
import { UsersTable } from "./users-table";

type AdminRole = "admin" | "clerk" | "player";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  await auth();

  const { role } = await searchParams;
  const validRole: AdminRole | undefined =
    role === "admin" || role === "clerk" || role === "player" ? role : undefined;

  const userList = await getUsersForAdmin(validRole);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link href="/admin/users/new" className={buttonVariants()}>
          Create User
        </Link>
      </div>
      <RoleFilterTabs currentRole={validRole} />
      <Card>
        <CardContent className="p-0">
          <UsersTable users={userList} />
        </CardContent>
      </Card>
    </div>
  );
}
