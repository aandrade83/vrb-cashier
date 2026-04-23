import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/UserMenu";
import { MasterExitButton } from "@/components/MasterExitButton";
import { PlayerEmailGate } from "@/components/player-email-gate";
import Link from "next/link";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { getCashier } from "@/lib/cashier-context";
import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  sendVerificationCodeAction,
  verifyCodeAction,
} from "./actions";

export default async function CashierPlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/player`;

  const [userSession, masterSession, cashier] = await Promise.all([
    getUserSession(),
    getMasterSession(),
    getCashier(),
  ]);

  const isMasterActing =
    masterSession?.type === "master" && !!masterSession.actingCashierId;

  let username = "";
  let requiresVerification = false;

  if (userSession?.type === "cashier") {
    const [user] = await db
      .select({
        username: cashierUsers.username,
        emailVerified: cashierUsers.emailVerified,
      })
      .from(cashierUsers)
      .where(eq(cashierUsers.id, userSession.userId))
      .limit(1);

    username = user?.username ?? "";

    // Gate only applies to real player sessions — masters bypass it
    if (userSession.role === "player" && !isMasterActing) {
      requiresVerification = !(user?.emailVerified ?? false);
    }
  }

  const masterBanner = isMasterActing ? (
    <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-sm text-amber-800">
      <span>
        You are acting as <strong>Player</strong> for this cashier.
      </span>
      <MasterExitButton />
    </div>
  ) : null;

  // ── Email verification gate ─────────────────────────────────────────────────
  if (requiresVerification) {
    return (
      <div className="flex min-h-screen flex-col">
        {masterBanner}
        <header className="border-b px-6 py-3 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {username && (
              <UserMenu username={username} slug={slug} token={token} />
            )}
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <PlayerEmailGate
            cashierName={cashier.name}
            sendCode={sendVerificationCodeAction}
            verifyCode={verifyCodeAction}
          />
        </main>
      </div>
    );
  }

  // ── Normal player layout ────────────────────────────────────────────────────
  const navItems = [
    { label: "Dashboard", href: `${base}/dashboard` },
    ...(cashier.depositsEnabled
      ? [{ label: "Deposits", href: `${base}/deposits` }]
      : []),
    ...(cashier.payoutsEnabled
      ? [{ label: "Payouts", href: `${base}/payouts` }]
      : []),
    { label: "Transactions", href: `${base}/transactions` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {masterBanner}
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
          {!isMasterActing && username && (
            <UserMenu username={username} slug={slug} token={token} />
          )}
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
