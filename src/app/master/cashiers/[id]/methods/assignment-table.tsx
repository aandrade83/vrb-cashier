"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashierMethodAssignment } from "@/data/methods";
import { setCashierMethodAssignmentsAction } from "./actions";

type Filter = "all" | "deposit" | "payout";

export function AssignmentTable({
  cashierId,
  assignments: initial,
  depositsEnabled = true,
  payoutsEnabled = true,
}: {
  cashierId: string;
  assignments: CashierMethodAssignment[];
  depositsEnabled?: boolean;
  payoutsEnabled?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [assignments, setAssignments] = useState(initial);
  const [, startTransition] = useTransition();

  const visibleAssignments = assignments.filter((a) => {
    if (a.type === "deposit" && !depositsEnabled) return false;
    if (a.type === "payout" && !payoutsEnabled) return false;
    return true;
  });

  const filtered =
    filter === "all" ? visibleAssignments : visibleAssignments.filter((a) => a.type === filter);

  function handleToggle(methodId: string, enabled: boolean) {
    const updated = assignments.map((a) =>
      a.methodId === methodId ? { ...a, enabled } : a,
    );
    setAssignments(updated);

    startTransition(async () => {
      const toSave = updated
        .filter((a) => a.enabled)
        .map((a) => ({ methodId: a.methodId, enabled: true as const }));
      await setCashierMethodAssignmentsAction(cashierId, toSave);
    });
  }

  const tabLabel = (f: Filter) => {
    if (f === "all") return `All (${visibleAssignments.length})`;
    const count = visibleAssignments.filter((a) => a.type === f).length;
    return `${f.charAt(0).toUpperCase() + f.slice(1)} (${count})`;
  };

  return (
    <>
      <div className="flex gap-1">
        {(["all", "deposit", "payout"] as const).filter((f) => {
          if (f === "deposit" && !depositsEnabled) return false;
          if (f === "payout" && !payoutsEnabled) return false;
          return true;
        }).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tabLabel(f)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No global methods exist yet.{" "}
          <a href="/master/methods" className="text-primary underline">
            Create some first.
          </a>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Method</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Global Status</TableHead>
              <TableHead>Enabled for Cashier</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.methodId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {a.logoUrl ? (
                      <img src={a.logoUrl} className="h-6 w-6 rounded object-contain shrink-0" alt="" />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted shrink-0" />
                    )}
                    <span className="font-medium">{a.methodName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={a.type === "deposit" ? "default" : "secondary"}>
                    {a.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={a.isActive ? "default" : "outline"}>
                    {a.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(checked) => handleToggle(a.methodId, checked)}
                    disabled={!a.isActive && !a.enabled}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
