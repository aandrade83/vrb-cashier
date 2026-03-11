import { auth } from "@clerk/nextjs/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";

type ClerkUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: { email_address: string }[];
  public_metadata: { role?: string };
};

async function getUsers(): Promise<ClerkUser[]> {
  const res = await fetch("https://api.clerk.com/v1/users?limit=50", {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function UsersPage() {
  await auth();
  const users = await getUsers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Link href="/admin/users/new" className={buttonVariants()}>
          Create User
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found.</p>
          ) : (
            <ul className="divide-y">
              {users.map((user) => (
                <li key={user.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {user.email_addresses[0]?.email_address}
                    </p>
                  </div>
                  <Badge variant="outline">
                    {user.public_metadata?.role ?? "no role"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
