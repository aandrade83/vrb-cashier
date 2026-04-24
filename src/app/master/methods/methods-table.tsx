"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { toggleGlobalMethodActiveAction, deleteGlobalMethodAction, getMethodPreviewAction, submitPreviewTransactionAction } from "./actions";
import { DepositForm } from "@/app/(player)/player/deposits/[methodId]/_components/DepositForm";
import { PayoutForm } from "@/app/(player)/player/payouts/[methodId]/_components/PayoutForm";
import type { MethodWithFieldCount, MethodWithFields } from "@/data/methods";

type Filter = "all" | "deposit" | "payout";

export function MethodsTable({ methods }: { methods: MethodWithFieldCount[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [, startTransition] = useTransition();

  const [previewMethod, setPreviewMethod] = useState<MethodWithFields | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSuccess, setPreviewSuccess] = useState(false);

  const filtered =
    filter === "all" ? methods : methods.filter((m) => m.type === filter);
  const deleting = deletingId ? methods.find((m) => m.id === deletingId) : null;

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleGlobalMethodActiveAction(id);
    });
  }

  async function handlePreview(id: string) {
    setPreviewLoading(true);
    const result = await getMethodPreviewAction(id);
    setPreviewLoading(false);
    if (result.success) setPreviewMethod(result.method);
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deletingId) return;
    setDeleteError("");
    setDeleteLoading(true);
    const result = await deleteGlobalMethodAction(deletingId);
    setDeleteLoading(false);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    setDeletingId(null);
    router.refresh();
  }

  const tabLabel = (f: Filter) => {
    if (f === "all") return `All (${methods.length})`;
    const count = methods.filter((m) => m.type === f).length;
    return `${f.charAt(0).toUpperCase() + f.slice(1)} (${count})`;
  };

  return (
    <>
      <div className="flex gap-1">
        {(["all", "deposit", "payout"] as const).map((f) => (
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
          No {filter === "all" ? "" : filter + " "}methods yet.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center" title="Number of form fields">Fields</TableHead>
              <TableHead className="text-center" title="Minimum completed deposits a player needs before this method unlocks">Min Dep</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((method) => (
              <TableRow key={method.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {method.logoUrl ? (
                      <img
                        src={method.logoUrl}
                        alt=""
                        className="h-6 w-6 rounded object-contain shrink-0"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded bg-muted shrink-0" />
                    )}
                    <span className="font-medium">{method.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={method.type === "deposit" ? "default" : "secondary"}>
                    {method.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-center text-muted-foreground">{method.fieldCount}</TableCell>
                <TableCell className="text-center text-muted-foreground">{method.activateNumber}</TableCell>
                <TableCell>
                  <Switch
                    checked={method.isActive}
                    onCheckedChange={() => handleToggle(method.id)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(method.id)}
                      disabled={previewLoading}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Link
                      href={`/master/methods/${method.id}/edit`}
                      className={buttonVariants({ variant: "ghost", size: "icon" })}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setDeletingId(method.id);
                        setDeleteError("");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewMethod} onOpenChange={(open) => { if (!open) { setPreviewMethod(null); setPreviewSuccess(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {previewMethod?.logoUrl ? (
                <Image
                  src={previewMethod.logoUrl}
                  alt={previewMethod?.name ?? ""}
                  width={32}
                  height={32}
                  className="rounded object-contain shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-muted shrink-0" />
              )}
              {previewMethod?.name}
            </DialogTitle>
            <DialogDescription>
              Live test — transaction will be submitted to the VRB cashier.
            </DialogDescription>
          </DialogHeader>

          {previewMethod?.description && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-100">
              {previewMethod.description}
            </div>
          )}

          {previewSuccess ? (
            <div className="py-6 text-center space-y-4">
              <p className="text-sm text-green-700 bg-green-50 rounded-lg border border-green-200 p-3">
                Test transaction submitted to VRB cashier successfully.
              </p>
              <Button variant="outline" onClick={() => { setPreviewMethod(null); setPreviewSuccess(false); }}>
                Close
              </Button>
            </div>
          ) : previewMethod?.type === "deposit" ? (
            <DepositForm
              method={previewMethod}
              fields={previewMethod.fields}
              submitAction={submitPreviewTransactionAction}
              onSuccess={() => setPreviewSuccess(true)}
            />
          ) : previewMethod ? (
            <PayoutForm
              method={previewMethod}
              fields={previewMethod.fields}
              submitAction={submitPreviewTransactionAction}
              onSuccess={() => setPreviewSuccess(true)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Method</DialogTitle>
            <DialogDescription>
              <strong>{deleting?.name}</strong> will be permanently deleted if it has no
              transaction history. If it does, it will be deactivated instead.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDelete} className="space-y-4 pt-2">
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
