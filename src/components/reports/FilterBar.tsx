"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TX_STATUS_LABEL } from "@/lib/transaction-statuses";

interface FilterBarProps {
  cashiers?: { id: string; name: string }[];
  methods?: { id: string; name: string; type: string }[];
  clerks?: { id: string; name: string }[];
  showCashierFilter?: boolean;
}

const ALL_STATUSES = Object.entries(TX_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export function FilterBar({
  cashiers = [],
  methods = [],
  clerks = [],
  showCashierFilter = false,
}: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams],
  );

  const reset = useCallback(() => {
    router.push("?");
  }, [router]);

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const cashier = searchParams.get("cashier") ?? "";
  const status = searchParams.get("status") ?? "";
  const method = searchParams.get("method") ?? "";
  const clerk = searchParams.get("clerk") ?? "";
  const q = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "";

  const hasFilters = from || to || cashier || status || method || clerk || q || type;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Filters
        </h2>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs h-7">
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {/* Date From */}
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <input
            type="date"
            value={from}
            onChange={(e) => update("from", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <input
            type="date"
            value={to}
            onChange={(e) => update("to", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        {/* Type */}
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={type || "_all"} onValueChange={(v) => update("type", v && v !== "_all" ? v : "")}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="payout">Payout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status || "_all"} onValueChange={(v) => update("status", v && v !== "_all" ? v : "")}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Method */}
        {methods.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Method</Label>
            <Select value={method || "_all"} onValueChange={(v) => update("method", v && v !== "_all" ? v : "")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All methods</SelectItem>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Clerk */}
        {clerks.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Clerk</Label>
            <Select value={clerk || "_all"} onValueChange={(v) => update("clerk", v && v !== "_all" ? v : "")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All clerks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All clerks</SelectItem>
                {clerks.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Cashier (master only) */}
        {showCashierFilter && cashiers.length > 0 && (
          <div className="space-y-1">
            <Label className="text-xs">Cashier</Label>
            <Select value={cashier || "_all"} onValueChange={(v) => update("cashier", v && v !== "_all" ? v : "")}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All cashiers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All cashiers</SelectItem>
                {cashiers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Player search */}
        <div className="space-y-1">
          <Label className="text-xs">Player</Label>
          <Input
            placeholder="Username or email…"
            value={q}
            onChange={(e) => update("q", e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
