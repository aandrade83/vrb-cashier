import { getCashierId } from "@/lib/cashier-context";
import { getAdminTransactions, STATUS_LABELS, STATUS_BADGE_VARIANT } from "@/data/admin-transactions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import Link from "next/link";

const DEPOSIT_TABS = [
  { label: "Pre-confirmed", statuses: ["pending"] as const },
  { label: "Post-confirmed", statuses: ["approved"] as const },
  { label: "Denied", statuses: ["rejected"] as const },
  { label: "Completed", statuses: ["completed"] as const },
] as const;

type Tab = typeof DEPOSIT_TABS[number]["label"];

export default async function AdminDepositsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ tab?: string; from?: string; to?: string; q?: string }>;
}) {
  const { slug, token } = await params;
  const { tab, from, to, q } = await searchParams;
  const base = `/${slug}/${token}/admin`;
  const cashierId = await getCashierId();

  const activeTab = (DEPOSIT_TABS.find((t) => t.label === tab) ?? DEPOSIT_TABS[0])!;

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  const rows = await getAdminTransactions({
    cashierId,
    type: "deposit",
    statuses: [...activeTab.statuses],
    from: fromDate,
    to: toDate,
    search: q,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Deposits</h1>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b pb-2">
        {DEPOSIT_TABS.map((t) => (
          <Link
            key={t.label}
            href={`${base}/deposits?tab=${encodeURIComponent(t.label)}`}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeTab.label === t.label
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No deposits found for today.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Reference</th>
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-left font-medium">Method</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{row.referenceCode}</td>
                    <td className="px-4 py-3">
                      <div>{[row.playerFirstName, row.playerLastName].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-muted-foreground text-xs">{row.playerEmail}</div>
                    </td>
                    <td className="px-4 py-3">{row.methodName}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {row.currency} {parseFloat(row.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "outline"}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {format(row.createdAt, "do MMM yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
