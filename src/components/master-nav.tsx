import Link from "next/link";
import { MasterLogoutButton } from "@/app/master/dashboard/logout-button";

const NAV_ITEMS = [
  { key: "cashiers", label: "Cashiers", href: "/master/dashboard" },
  { key: "queue", label: "Queue", href: "/master/queue" },
  { key: "reports", label: "Reports", href: "/master/clerk/reports" },
  { key: "users", label: "Users", href: "/master/users" },
  { key: "methods", label: "Methods", href: "/master/methods" },
  { key: "name-lists", label: "Name Lists", href: "/master/name-lists" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

export function MasterNav({ active }: { active: NavKey }) {
  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <span className="font-bold text-sm">Cashier Master</span>
        <nav className="flex gap-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={
                item.key === active
                  ? "text-sm font-medium text-primary border-b-2 border-primary pb-0.5"
                  : "text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <MasterLogoutButton />
    </header>
  );
}
