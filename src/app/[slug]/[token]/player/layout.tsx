import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/UserMenu";
import Link from "next/link";
import { getUserSession } from "@/lib/auth/session";
import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function CashierPlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/player`;

  const userSession = await getUserSession();

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
    { label: "Deposits", href: `${base}/deposits` },
    { label: "Payouts", href: `${base}/payouts` },
    { label: "Transactions", href: `${base}/transactions` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <nav className="flex gap-6">
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
          {username && <UserMenu username={username} slug={slug} token={token} />}
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
