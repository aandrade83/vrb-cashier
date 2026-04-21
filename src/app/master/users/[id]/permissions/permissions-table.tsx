"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashierPermissionRow } from "@/data/master-users";
import { togglePermissionAction } from "./actions";

export function PermissionsTable({
  masterUserId,
  rows: initial,
}: {
  masterUserId: string;
  rows: CashierPermissionRow[];
}) {
  const [rows, setRows] = useState(initial);
  const [, startTransition] = useTransition();

  function handleToggle(cashierId: string, assign: boolean) {
    setRows((prev) =>
      prev.map((r) => (r.cashierId === cashierId ? { ...r, assigned: assign } : r)),
    );
    startTransition(async () => {
      await togglePermissionAction(masterUserId, cashierId, assign);
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No cashiers exist yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cashier</TableHead>
          <TableHead>Access Granted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.cashierId}>
            <TableCell className="font-medium">{row.cashierName}</TableCell>
            <TableCell>
              <Switch
                checked={row.assigned}
                onCheckedChange={(checked) => handleToggle(row.cashierId, checked)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
