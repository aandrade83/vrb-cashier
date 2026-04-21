import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/UserMenu";
import { MasterExitButton } from "@/components/MasterExitButton";
import Link from "next/link";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CashierClerkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/clerk`;

  const [userSession, masterSession] = await Promise.all([
    getUserSession(),
    getMasterSession(),
  ]);

  const isMasterActing =
    masterSession?.type === "master" && !!masterSession.actingCashierId;

  let username = "";
  if (userSession?.type === "cashier") {
    const [user] = await db
      .select({ username: cashierUsers.username })
      .from(cashierUsers)
      .where(eq(cashierUsers.id, userSession.userId))
      .limit(1);
    username = user?.username ?? "";
  }

  return (
    <div className="flex min-h-screen flex-col">
      {isMasterActing && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm text-amber-800">
          <span>
            You are acting as <strong>Clerk</strong> for this cashier.
          </span>
          <MasterExitButton />
        </div>
      )}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <nav className="flex gap-6">
          <Link
            href={`${base}/queue`}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Queue
          </Link>
          <Link
            href={`${base}/player-view`}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Players
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!isMasterActing && username && <UserMenu username={username} slug={slug} token={token} />}
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
