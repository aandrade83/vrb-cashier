import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/UserMenu";
import { MasterExitButton } from "@/components/MasterExitButton";
import Link from "next/link";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CashierAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/admin`;

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

  const navItems = [
    { label: "Dashboard", href: `${base}/dashboard` },
    { label: "Users", href: `${base}/users` },
    { label: "Methods", href: `${base}/methods` },
    { label: "Clerks", href: `${base}/clerks` },
    { label: "Players", href: `${base}/players` },
    { label: "Deposits", href: `${base}/deposits` },
    { label: "Payouts", href: `${base}/payouts` },
    { label: "Names", href: `${base}/names` },
    { label: "Addresses", href: `${base}/addresses` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {isMasterActing && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm text-amber-800">
          <span>
            You are acting as <strong>Admin</strong> for this cashier.
          </span>
          <MasterExitButton />
        </div>
      )}
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <nav className="flex gap-6 flex-wrap items-center">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {!isMasterActing && username && (
            <UserMenu username={username} slug={slug} token={token} />
          )}
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
