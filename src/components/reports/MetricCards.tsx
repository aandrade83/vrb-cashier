import { Card, CardContent } from "@/components/ui/card";
import type { ReportMetrics } from "@/data/reports";

interface Props {
  metrics: ReportMetrics;
}

function fmt(n: number | null, unit = ""): string {
  if (n == null) return "—";
  return `${n.toLocaleString()}${unit}`;
}

function fmtMins(mins: number | null): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtAmount(amount: string): string {
  const n = parseFloat(amount);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "amber" | "blue";
}) {
  const accentClass =
    accent === "green" ? "text-green-600 dark:text-green-400" :
    accent === "red"   ? "text-destructive" :
    accent === "amber" ? "text-amber-600 dark:text-amber-400" :
    accent === "blue"  ? "text-blue-600 dark:text-blue-400" :
    "";

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${accentClass}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function MetricCards({ metrics: m }: Props) {
  return (
    <div className="space-y-3">
      {/* Primary row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total Transactions" value={fmt(m.totalTransactions)} />
        <Stat
          label="Completed Amount"
          value={fmtAmount(m.totalCompletedAmount)}
          accent="green"
        />
        <Stat
          label="Denied"
          value={fmt(m.totalDeniedCount)}
          accent={m.totalDeniedCount > 0 ? "red" : undefined}
        />
        <Stat
          label="Avg Completion"
          value={fmtMins(m.avgCompletionMinutes)}
          sub="assigned → completed"
        />
        <Stat
          label="Pending Now"
          value={fmt(m.pendingNow)}
          accent={m.pendingNow > 0 ? "amber" : undefined}
        />
        <Stat
          label="Unassigned Now"
          value={fmt(m.unassignedNow)}
          accent={m.unassignedNow > 0 ? "amber" : undefined}
        />
      </div>

      {/* Advanced row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Avg Queue Wait"
          value={fmtMins(m.avgUnassignedToPendingMinutes)}
          sub="unassigned → pending"
        />
        <Stat
          label="Avg Handle Time"
          value={fmtMins(m.avgPendingToCompletedMinutes)}
          sub="pending → completed"
        />
        <Stat
          label="Top Clerk"
          value={m.bestClerkName ?? "—"}
          sub={m.bestClerkVolume > 0 ? `${m.bestClerkVolume} completed` : undefined}
          accent={m.bestClerkName ? "blue" : undefined}
        />
        <Stat
          label="Oldest Pending"
          value={fmtMins(m.slowestPendingAgeMinutes)}
          sub="time since created"
          accent={
            m.slowestPendingAgeMinutes != null && m.slowestPendingAgeMinutes > 60
              ? "red"
              : m.slowestPendingAgeMinutes != null
              ? "amber"
              : undefined
          }
        />
      </div>
    </div>
  );
}
