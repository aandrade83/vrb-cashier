import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import { headers } from "next/headers";
import { CASHIER_SLUG_HEADER, CASHIER_TOKEN_HEADER } from "@/lib/cashier-context";

export default async function CashierAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/admin`;

  const navItems = [
    { label: "Dashboard", href: `${base}/dashboard` },
    { label: "Users", href: `${base}/users` },
    { label: "Methods", href: `${base}/methods` },
    { label: "Clerks", href: `${base}/clerks` },
    { label: "Players", href: `${base}/players` },
    { label: "Deposits", href: `${base}/deposits` },
    { label: "Payouts", href: `${base}/payouts` },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <nav className="flex gap-6 flex-wrap">
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
          <UserButton />
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
