import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

const navItems = [
  { label: "Queue", href: "/clerk/queue" },
  { label: "Reports", href: "/clerk/reports" },
];

export default function ClerkLayout({ children }: { children: React.ReactNode }) {
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
        <UserButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
