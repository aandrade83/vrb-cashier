"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/lib/button-variants";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toggleMethodActiveAction, deleteMethodAction } from "./actions";
import type { MethodWithFieldCount } from "@/data/methods";

type Props = {
  methods: MethodWithFieldCount[];
  base: string;
};

export function MethodsTable({ methods, base }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [hideInactive, setHideInactive] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  function handleToggle(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await toggleMethodActiveAction({ id });
      router.refresh();
      setPendingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    setDeleteMessage(null);
    setDeleteTarget({ id, name });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    startTransition(async () => {
      const result = await deleteMethodAction({ id });
      setDeleteTarget(null);
      if (!result.success) {
        setDeleteMessage(`Error: ${result.error}`);
      } else if (result.deleted === false && result.deactivated) {
        setDeleteMessage(
          "This method has transaction history and cannot be deleted. It has been deactivated instead."
        );
        router.refresh();
      } else {
        router.refresh();
      }
    });
  }

  const displayed = hideInactive ? methods.filter((m) => m.isActive) : methods;

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Switch
          checked={hideInactive}
          onCheckedChange={(v) => setHideInactive(v)}
          id="hide-inactive"
        />
        <label htmlFor="hide-inactive" className="text-sm cursor-pointer select-none">
          Hide Deactivated Methods
        </label>
      </div>

      {deleteMessage && (
        <div className="mx-4 mt-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          {deleteMessage}
        </div>
      )}

      {displayed.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No methods found. Create one to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Logo</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Fields</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayed.map((method) => (
              <TableRow key={method.id}>
                <TableCell>
                  {method.logoUrl ? (
                    <Image
                      src={method.logoUrl}
                      alt={method.name}
                      width={40}
                      height={40}
                      className="rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-medium">{method.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {method.type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={method.isActive ? "default" : "secondary"}>
                    {method.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>{method.fieldCount} field{method.fieldCount !== 1 ? "s" : ""}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending && pendingId === method.id}
                    onClick={() => handleToggle(method.id)}
                  >
                    {method.isActive ? "Deactivate" : "Activate"}
                  </Button>
                  <Link
                    href={`${base}/methods/${method.id}/edit`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Edit
                  </Link>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(method.id, method.name)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? If it has
              transaction history it will be deactivated instead of deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isPending}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
