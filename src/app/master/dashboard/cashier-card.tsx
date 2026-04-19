"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { toggleCashierActiveAction, deleteCashierAction, editCashierAction } from "./actions";
import type { Cashier } from "@/db/schema";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface Props {
  cashier: Cashier;
}

export function CashierCard({ cashier }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [visitLoading, setVisitLoading] = useState(false);

  // ── Edit dialog ──────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(cashier.name);
  const [editClientUrl, setEditClientUrl] = useState(cashier.clientUrl ?? "");
  const [editEmail, setEditEmail] = useState(cashier.contactEmail ?? "");
  const [editPhone, setEditPhone] = useState(cashier.contactPhone ?? "");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // ── Delete dialog ────────────────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  //const cashierUrl = `${APP_URL}/${cashier.slug}/${cashier.token}/`;
  const cashierUrl = `${APP_URL.replace(/\/$/, "")}/${cashier.slug}/${cashier.token}/`;

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleVisit() {
    setVisitLoading(true);
    try {
      const res = await fetch("/api/master/visit-cashier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashierId: cashier.id }),
      });
      const data = await res.json();
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } finally {
      setVisitLoading(false);
    }
  }

  function handleToggle() {
    startTransition(async () => {
      await toggleCashierActiveAction(cashier.id);
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditLoading(true);
    const result = await editCashierAction({
      id: cashier.id,
      name: editName,
      clientUrl: editClientUrl,
      contactEmail: editEmail,
      contactPhone: editPhone,
    });
    setEditLoading(false);
    if (result.error) {
      setEditError(result.error);
    } else {
      setEditOpen(false);
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError("");
    setDeleteLoading(true);
    const result = await deleteCashierAction({
      id: cashier.id,
      password: deletePassword,
    });
    setDeleteLoading(false);
    if (result.error) {
      setDeleteError(result.error);
    } else {
      setDeleteOpen(false);
    }
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardContent className="pt-4 flex-1 space-y-3 text-sm">
          {/* Header row: name + active toggle */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-base truncate">{cashier.name}</p>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {cashier.isActive ? "Active" : "Inactive"}
              </span>
              <Switch
                checked={cashier.isActive}
                onCheckedChange={handleToggle}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Slug */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slug</span>
            <code className="font-mono">{cashier.slug}</code>
          </div>

          {/* Token */}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token</span>
            <code className="font-mono">{cashier.token}</code>
          </div>

          {/* Cashier URL (production link for client) */}
          <div className="space-y-0.5">
            <p className="text-muted-foreground">Cashier URL</p>
            <a
              href={cashierUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-primary underline underline-offset-2 break-all"
            >
              {cashierUrl}
            </a>
          </div>

          {/* Client site URL */}
          {cashier.clientUrl && (
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground shrink-0">Client site</span>
              <a
                href={cashier.clientUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline underline-offset-2 truncate"
              >
                {cashier.clientUrl}
              </a>
            </div>
          )}

          {/* Contact */}
          {cashier.contactEmail && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="truncate max-w-[160px]">{cashier.contactEmail}</span>
            </div>
          )}
          {cashier.contactPhone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="truncate max-w-[160px]">{cashier.contactPhone}</span>
            </div>
          )}
        </CardContent>

        {/* Footer: Visit | Edit | Delete */}
        <CardFooter className="flex items-center justify-between pt-2 pb-4 px-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleVisit}
            disabled={visitLoading || !cashier.isActive}
          >
            {visitLoading ? "Opening..." : "Visit as Admin"}
          </Button>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditOpen(true)}
              title="Edit cashier"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteOpen(true)}
              title="Delete cashier"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* ── Edit Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cashier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 pt-2">
            {editError && (
              <p className="text-sm text-destructive">{editError}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-client-url">Client Site URL (optional)</Label>
              <Input
                id="edit-client-url"
                type="url"
                placeholder="https://client-site.com"
                value={editClientUrl}
                onChange={(e) => setEditClientUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The URL of the client&apos;s website where this cashier is embedded.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Contact Email (optional)</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-phone">Contact Phone (optional)</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cashier</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{cashier.name}</strong> and all
              its data. This action cannot be undone. Enter the master password to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDelete} className="space-y-4 pt-2">
            {deleteError && (
              <p className="text-sm text-destructive">{deleteError}</p>
            )}
            <div className="space-y-1">
              <Label htmlFor="delete-password">Master Password</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteLoading}>
                {deleteLoading ? "Deleting..." : "Delete cashier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
