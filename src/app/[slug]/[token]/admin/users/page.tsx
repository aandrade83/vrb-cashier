import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/lib/button-variants";
import Link from "next/link";
import { getUsersForAdmin } from "@/data/users";
import { getCashierId } from "@/lib/cashier-context";
import { RoleFilterTabs } from "@/app/(admin)/admin/users/role-filter-tabs";
import { UsersTable } from "@/app/(admin)/admin/users/users-table";

type AdminRole = "admin" | "clerk" | "player";

export default async function CashierUsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { slug, token } = await params;
  const { role } = await searchParams;
  const cashierId = await getCashierId();

  const validRole: AdminRole | undefined =
    role === "admin" || role === "clerk" || role === "player" ? role : undefined;

  const userList = await getUsersForAdmin(cashierId, validRole);
  const base = `/${slug}/${token}/admin`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link href={`${base}/users/new`} className={buttonVariants()}>
          Create User
        </Link>
      </div>
      <RoleFilterTabs currentRole={validRole} basePath={base} />
      <Card>
        <CardContent className="p-0">
          <UsersTable users={userList} />
        </CardContent>
      </Card>
    </div>
  );
}
