import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type Props = {
  currentRole?: string;
};

const tabs = [
  { label: "All",    href: "/admin/users",               value: undefined },
  { label: "Admin",  href: "/admin/users?role=admin",    value: "admin" },
  { label: "Clerk",  href: "/admin/users?role=clerk",    value: "clerk" },
  { label: "Player", href: "/admin/users?role=player",   value: "player" },
];

export function RoleFilterTabs({ currentRole }: Props) {
  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={cn(
            buttonVariants({ variant: currentRole === tab.value ? "default" : "outline", size: "sm" })
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
