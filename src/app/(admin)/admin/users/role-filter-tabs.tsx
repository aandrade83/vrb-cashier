import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type Props = {
  currentRole?: string;
  basePath: string;
};

export function RoleFilterTabs({ currentRole, basePath }: Props) {
  const tabs = [
    { label: "All",    href: `${basePath}/users`,               value: undefined },
    { label: "Admin",  href: `${basePath}/users?role=admin`,    value: "admin" },
    { label: "Clerk",  href: `${basePath}/users?role=clerk`,    value: "clerk" },
    { label: "Player", href: `${basePath}/users?role=player`,   value: "player" },
  ];

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
