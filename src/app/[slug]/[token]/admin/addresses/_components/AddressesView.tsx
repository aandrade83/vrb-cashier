"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Address } from "@/db/schema";
import {
  createAddressAction,
  updateAddressAction,
  deleteAddressAction,
} from "../actions";

interface Props {
  addresses: Address[];
  slug: string;
  token: string;
}

export function AddressesView({ addresses, slug, token }: Props) {
  const [isPending, startTransition] = useTransition();

  const [newValue, setNewValue] = useState("");
  const [newPriority, setNewPriority] = useState(0);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editPriority, setEditPriority] = useState(0);

  function handleAdd() {
    if (!newValue.trim()) {
      setAddError("Address cannot be empty.");
      return;
    }
    setAddError("");
    startTransition(async () => {
      await createAddressAction({ value: newValue.trim(), priority: newPriority, slug, token });
      setNewValue("");
      setNewPriority(0);
    });
  }

  function startEdit(address: Address) {
    setEditingId(address.id);
    setEditValue(address.value);
    setEditPriority(address.priority);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleSaveEdit(id: string) {
    startTransition(async () => {
      await updateAddressAction({ id, value: editValue.trim(), priority: editPriority, slug, token });
      setEditingId(null);
    });
  }

  function handleToggleActive(address: Address) {
    startTransition(async () => {
      await updateAddressAction({ id: address.id, isActive: !address.isActive, slug, token });
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this address? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteAddressAction({ id, slug, token });
    });
  }

  return (
    <div className="space-y-6">
      {/* Add Form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Add New Address</p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              placeholder="e.g. 123 Main St, New York, NY"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 min-w-60 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Priority</label>
              <input
                type="number"
                min={0}
                value={newPriority}
                onChange={(e) => setNewPriority(Number(e.target.value))}
                className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
          {addError && <p className="text-xs text-destructive">{addError}</p>}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No addresses yet. Add one above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Priority</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Locked At</th>
                  <th className="px-4 py-3 text-left">Active</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {addresses.map((address) => (
                  <tr key={address.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium max-w-xs">
                      {editingId === address.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        <span className="line-clamp-2">{address.value}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === address.id ? (
                        <input
                          type="number"
                          min={0}
                          value={editPriority}
                          onChange={(e) => setEditPriority(Number(e.target.value))}
                          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      ) : (
                        address.priority
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {address.isLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {address.lockedAt
                        ? new Date(address.lockedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={address.isActive}
                        onCheckedChange={() => handleToggleActive(address)}
                        disabled={isPending || address.isLocked}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === address.id ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleSaveEdit(address.id)}
                            disabled={isPending}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => startEdit(address)}
                            disabled={isPending || address.isLocked}
                            className="text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(address.id)}
                            disabled={isPending || address.isLocked}
                            className="text-xs text-destructive hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
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
