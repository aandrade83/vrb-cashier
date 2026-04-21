"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import {
  toggleNameActiveAction,
  updateNamePriorityAction,
  deleteNameAction,
} from "./actions";
import type { PoolRow } from "@/data/names-pool";

interface Props {
  rows: PoolRow[];
  cashierId: string;
}

function statusBadge(row: PoolRow) {
  if (row.isLocked) return <Badge variant="secondary">Locked</Badge>;
  if (!row.isActive) return <Badge variant="outline">Inactive</Badge>;
  return <Badge variant="default">Active</Badge>;
}

export function NamesTable({ rows, cashierId }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editingPriority, setEditingPriority] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleNameActiveAction(id);
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteNameAction(id);
      if (!result.success) {
        setErrors((prev) => ({ ...prev, [id]: result.error }));
      } else {
        router.refresh();
      }
    });
  }

  async function handlePrioritySave(id: string) {
    const val = editingPriority[id];
    if (val === undefined) return;
    const p = parseInt(val, 10);
    if (isNaN(p) || p < 0) {
      setErrors((prev) => ({ ...prev, [id]: "Must be ≥ 0" }));
      return;
    }
    setErrors((prev) => ({ ...prev, [id]: "" }));
    const result = await updateNamePriorityAction(id, p);
    if (!result.success) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }
    setEditingPriority((prev) => { const n = { ...prev }; delete n[id]; return n; });
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="text-center py-12 text-sm text-muted-foreground">
        No names in the pool yet. Add one above.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Value</TableHead>
          <TableHead className="w-28">Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Locked by</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-sm">{row.value}</TableCell>

            <TableCell>
              {editingPriority[row.id] !== undefined ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="h-7 w-16 text-sm"
                    value={editingPriority[row.id]}
                    min={0}
                    onChange={(e) =>
                      setEditingPriority((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handlePrioritySave(row.id);
                      if (e.key === "Escape")
                        setEditingPriority((prev) => { const n = { ...prev }; delete n[row.id]; return n; });
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => handlePrioritySave(row.id)}
                  >
                    ✓
                  </Button>
                </div>
              ) : (
                <button
                  className="text-sm tabular-nums hover:underline text-muted-foreground"
                  onClick={() =>
                    setEditingPriority((prev) => ({ ...prev, [row.id]: String(row.priority) }))
                  }
                  title="Click to edit priority"
                >
                  {row.priority}
                </button>
              )}
              {errors[row.id] && (
                <p className="text-xs text-destructive mt-0.5">{errors[row.id]}</p>
              )}
            </TableCell>

            <TableCell>{statusBadge(row)}</TableCell>

            <TableCell className="text-sm text-muted-foreground">
              {row.lockedByReferenceCode ?? "—"}
            </TableCell>

            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={row.isLocked}
                  onClick={() => handleToggle(row.id)}
                >
                  {row.isActive ? "Disable" : "Enable"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={row.isLocked}
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.id)}
                  title={row.isLocked ? "Cannot delete a locked name" : "Delete"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
