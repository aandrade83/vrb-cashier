import Link from "next/link";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";

type Props = {
  currentType: "deposit" | "payout";
};

const tabs = [
  { label: "Deposits", href: "/admin/methods?type=deposit", value: "deposit" as const },
  { label: "Payouts", href: "/admin/methods?type=payout", value: "payout" as const },
];

export function TypeFilterTabs({ currentType }: Props) {
  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          className={cn(
            buttonVariants({ variant: currentType === tab.value ? "default" : "outline", size: "sm" })
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
