import { isMasterAuthenticated } from "@/lib/master-auth";
import { getUserSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { CreateUserForm } from "@/app/(admin)/admin/users/new/create-user-form";

export default async function NewUserPage({
  params,
}: {
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;

  const userSession = await getUserSession();
  const isMaster = await isMasterAuthenticated();
  if (!userSession && !isMaster) redirect(`/${slug}/${token}/sign-in`);

  const redirectPath = `/${slug}/${token}/admin/users`;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Create User</h1>
      <CreateUserForm redirectPath={redirectPath} />
    </div>
  );
}
