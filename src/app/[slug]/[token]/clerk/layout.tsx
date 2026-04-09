import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

export default async function CashierClerkLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  const base = `/${slug}/${token}/clerk`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <nav className="flex gap-6">
          <Link href={`${base}/queue`} className="text-sm font-medium hover:text-primary transition-colors">
            Queue
          </Link>
          <Link href={`${base}/player-view`} className="text-sm font-medium hover:text-primary transition-colors">
            Players
          </Link>
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
