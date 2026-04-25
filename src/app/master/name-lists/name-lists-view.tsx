"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LockedNameRow,
  NameListRow,
  NameListNameRow,
  MethodWithListsAndNames,
} from "@/data/name-lists";
import {
  createNameListAction,
  addSingleNameToListAction,
  addBulkNamesToListAction,
  updateNameInListAction,
  toggleNameActiveAction,
  deleteNameFromListAction,
  removeCashierFromListAction,
  deleteNameListAction,
} from "./actions";

interface Props {
  lockedNames: LockedNameRow[];
  methodsForCreate: {
    id: string;
    name: string;
    type: string;
    availableCashiers: { id: string; name: string; slug: string }[];
  }[];
  methodsWithLists: MethodWithListsAndNames[];
}

function StatusBadge({ status }: { status: NameListNameRow["status"] }) {
  if (status === "locked") return <Badge variant="secondary">Locked</Badge>;
  if (status === "inactive") return <Badge variant="outline">Inactive</Badge>;
  return <Badge variant="default">Available</Badge>;
}

// ─────────────────────────────────────────────────────────────
// Shared helper — opens transaction in popup window
// ─────────────────────────────────────────────────────────────
function openTxPopup(transactionId: string) {
  window.open(
    `/master/queue/${transactionId}`,
    `tx-${transactionId}`,
    "popup,width=960,height=720,scrollbars=yes,resizable=yes",
  );
}

function ReferenceCell({ transactionId, referenceCode }: { transactionId: string | null; referenceCode: string | null }) {
  if (!referenceCode || !transactionId) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      className="font-mono text-sm text-primary underline underline-offset-2 hover:no-underline"
      onClick={() => openTxPopup(transactionId)}
    >
      {referenceCode}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// Locked Names Panel — summary only, no direct action
// ─────────────────────────────────────────────────────────────
function LockedNamesPanel({ lockedNames }: { lockedNames: LockedNameRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Locked Names</CardTitle>
      </CardHeader>
      <CardContent>
        {lockedNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No names currently locked.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Last Used</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lockedNames.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.value}</TableCell>
                    <TableCell className="text-sm">{row.methodName}</TableCell>
                    <TableCell>
                      <ReferenceCell
                        transactionId={row.lockedByTransactionId}
                        referenceCode={row.transactionReferenceCode}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(row.transactionCreatedAt), "yyyy-MM-dd hh:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Create List Panel (Section A)
// ─────────────────────────────────────────────────────────────
function CreateListPanel({ methodsForCreate }: { methodsForCreate: Props["methodsForCreate"] }) {
  const router = useRouter();
  const [selectedMethodId, setSelectedMethodId] = useState("");
  const [newCashierIds, setNewCashierIds] = useState<string[]>([]);
  const [newBlockingMode, setNewBlockingMode] = useState<"yes" | "no">("yes");
  const [createError, setCreateError] = useState("");
  const [createPending, setCreatePending] = useState(false);

  const selectedMethod = methodsForCreate.find((m) => m.id === selectedMethodId) ?? null;

  function handleMethodSelect(id: string | null) {
    setSelectedMethodId(id ?? "");
    const method = methodsForCreate.find((m) => m.id === id);
    setNewCashierIds(method?.availableCashiers.map((c) => c.id) ?? []);
    setCreateError("");
  }

  function toggleCashier(id: string) {
    setNewCashierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMethodId || newCashierIds.length === 0) return;
    setCreateError("");
    setCreatePending(true);
    const result = await createNameListAction(selectedMethodId, newCashierIds, newBlockingMode);
    setCreatePending(false);
    if (!result.success) {
      setCreateError(result.error);
      return;
    }
    setSelectedMethodId("");
    setNewCashierIds([]);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create New List</CardTitle>
      </CardHeader>
      <CardContent>
        {methodsForCreate.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All methods are fully assigned — no new lists can be created.
          </p>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={selectedMethodId} onValueChange={handleMethodSelect}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select a method…">
                    {selectedMethod
                      ? `${selectedMethod.name} · ${selectedMethod.type}`
                      : "Select a method…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {methodsForCreate.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} · {m.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedMethod && (
              <>
                <div className="space-y-2">
                  <Label>Cashiers</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMethod.availableCashiers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCashier(c.id)}
                        className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                          newCashierIds.includes(c.id)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-border hover:border-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  {newCashierIds.length === 0 && (
                    <p className="text-xs text-destructive">Select at least one cashier.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Blocking Mode</Label>
                  <div className="flex gap-2">
                    {(["yes", "no"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setNewBlockingMode(mode)}
                        className={`flex-1 max-w-xs px-3 py-2.5 text-sm rounded-md border text-left transition-colors ${
                          newBlockingMode === mode
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-border hover:border-foreground"
                        }`}
                      >
                        <div className="font-medium">
                          {mode === "yes" ? "Block until Pre-Confirmed" : "Free Rotation"}
                        </div>
                        <div className="text-xs opacity-70 mt-0.5">
                          {mode === "yes"
                            ? "Name is locked while transaction is active"
                            : "Next name in rotation, no locking"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {createError && <p className="text-sm text-destructive">{createError}</p>}

                <Button type="submit" disabled={createPending || newCashierIds.length === 0}>
                  {createPending ? "Creating…" : "Create List"}
                </Button>
              </>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Per-list editor — names table + add form
// ─────────────────────────────────────────────────────────────
function ListEditor({
  list,
  names,
}: {
  list: NameListRow;
  names: NameListNameRow[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const nextPriority = names.length > 0 ? Math.max(...names.map((n) => n.priority)) + 1 : 1;

  const [addTab, setAddTab] = useState<"single" | "bulk">("single");
  const [addValue, setAddValue] = useState("");
  const [addPriority, setAddPriority] = useState(String(nextPriority));
  const [addBulk, setAddBulk] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [addPending, setAddPending] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [removeCashierErrors, setRemoveCashierErrors] = useState<Record<string, string>>({});

  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [deleteListError, setDeleteListError] = useState("");
  const [deleteListPending, setDeleteListPending] = useState(false);

  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");
    setAddPending(true);
    const p = parseInt(addPriority, 10);
    const result = await addSingleNameToListAction(
      list.id,
      addValue,
      isNaN(p) || p < 1 ? 1 : p,
    );
    setAddPending(false);
    if (!result.success) {
      setAddMsg(result.error);
      return;
    }
    if (result.skipped > 0) {
      setAddMsg("Name already exists in this list.");
    } else {
      setAddValue("");
      setAddPriority((prev) => String(parseInt(prev, 10) + 1));
      router.refresh();
    }
  }

  async function handleAddBulk(e: React.FormEvent) {
    e.preventDefault();
    setAddMsg("");
    setAddPending(true);
    const result = await addBulkNamesToListAction(list.id, addBulk);
    setAddPending(false);
    if (!result.success) {
      setAddMsg(result.error);
      return;
    }
    const skipMsg =
      result.skipped > 0
        ? `${result.skipped} name${result.skipped !== 1 ? "s" : ""} skipped (already exist in this list).`
        : "";
    if (result.added > 0) {
      setAddBulk("");
      router.refresh();
    }
    if (skipMsg) setAddMsg(skipMsg);
  }

  function startEdit(row: NameListNameRow) {
    setEditingId(row.id);
    setEditValue(row.value);
    setEditPriority(String(row.priority));
    setRowErrors((prev) => ({ ...prev, [row.id]: "" }));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    const p = parseInt(editPriority, 10);
    if (isNaN(p) || p < 1) {
      setRowErrors((prev) => ({ ...prev, [id]: "Priority must be ≥ 1" }));
      return;
    }
    const result = await updateNameInListAction(id, { value: editValue, priority: p });
    if (!result.success) {
      setRowErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  function handleToggleActive(id: string, currentIsActive: boolean) {
    startTransition(async () => {
      const result = await toggleNameActiveAction(id, !currentIsActive);
      if (!result.success) setRowErrors((prev) => ({ ...prev, [id]: result.error }));
      else router.refresh();
    });
  }

  function handleDeleteName(id: string) {
    startTransition(async () => {
      const result = await deleteNameFromListAction(id);
      if (!result.success) setRowErrors((prev) => ({ ...prev, [id]: result.error }));
      else router.refresh();
    });
  }

  function handleRemoveCashier(cashierId: string) {
    startTransition(async () => {
      const result = await removeCashierFromListAction(list.id, cashierId);
      if (!result.success)
        setRemoveCashierErrors((prev) => ({ ...prev, [cashierId]: result.error }));
      else {
        setRemoveCashierErrors((prev) => ({ ...prev, [cashierId]: "" }));
        router.refresh();
      }
    });
  }

  async function handleDeleteList() {
    if (!deleteListId) return;
    setDeleteListError("");
    setDeleteListPending(true);
    const result = await deleteNameListAction(deleteListId);
    setDeleteListPending(false);
    if (!result.success) {
      setDeleteListError(result.error);
      return;
    }
    setDeleteListId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4 pt-2">
      {/* List header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {list.cashiers.map((c) => (
              <div key={c.id} className="flex items-center gap-0.5">
                <Badge variant="secondary" className="pr-1">
                  {c.name}
                  <button
                    type="button"
                    className="ml-1 opacity-60 hover:opacity-100 hover:text-destructive transition-colors"
                    title={`Remove ${c.name} from this list`}
                    onClick={() => handleRemoveCashier(c.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
                {removeCashierErrors[c.id] && (
                  <span className="text-xs text-destructive ml-1">
                    {removeCashierErrors[c.id]}
                  </span>
                )}
              </div>
            ))}
            <Badge variant={list.blockingMode === "yes" ? "default" : "outline"}>
              {list.blockingMode === "yes" ? "Blocking" : "Free Rotation"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {list.nameCount} name{list.nameCount !== 1 ? "s" : ""} in list
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive shrink-0"
          onClick={() => {
            setDeleteListId(list.id);
            setDeleteListError("");
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete List
        </Button>
      </div>

      {/* Add name form */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex gap-2">
          {(["single", "bulk"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setAddTab(t);
                setAddMsg("");
              }}
              className={`px-3 py-1 text-sm rounded-md ${
                addTab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {t === "single" ? "Add Name" : "Bulk Import"}
            </button>
          ))}
        </div>

        {addTab === "single" ? (
          <form onSubmit={handleAddSingle} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor={`add-${list.id}-value`}>Name</Label>
              <Input
                id={`add-${list.id}-value`}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="e.g. John Smith"
                required
              />
            </div>
            <div className="w-24 space-y-1">
              <Label htmlFor={`add-${list.id}-priority`}>Priority</Label>
              <Input
                id={`add-${list.id}-priority`}
                type="number"
                min={1}
                step={1}
                value={addPriority}
                onChange={(e) => setAddPriority(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={addPending}>
              {addPending ? "Adding…" : "Add"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleAddBulk} className="space-y-2">
            <div className="space-y-1">
              <Label>One name per line — priority assigned by order</Label>
              <textarea
                value={addBulk}
                onChange={(e) => setAddBulk(e.target.value)}
                rows={5}
                placeholder={"John Smith\nMaria Garcia\nDavid Lee"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button type="submit" disabled={addPending}>
              {addPending ? "Importing…" : "Import"}
            </Button>
          </form>
        )}

        {addMsg && (
          <p
            className={`text-sm ${
              addMsg.includes("skipped") ? "text-muted-foreground" : "text-destructive"
            }`}
          >
            {addMsg}
          </p>
        )}
      </div>

      {/* Names table */}
      {names.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10 border rounded-lg">
          No names in this list yet. Add one above.
        </p>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-24">Priority</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right w-48">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {names.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editingId === row.id ? (
                        <Input
                          className="h-7 text-sm"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(row.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        <button
                          type="button"
                          className="font-mono text-sm hover:underline text-left"
                          onClick={() => startEdit(row)}
                          title="Click to edit"
                        >
                          {row.value}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === row.id ? (
                        <Input
                          type="number"
                          className="h-7 w-16 text-sm"
                          min={1}
                          step={1}
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(row.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-sm tabular-nums hover:underline text-muted-foreground"
                          onClick={() => startEdit(row)}
                          title="Click to edit priority"
                        >
                          {row.priority}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <ReferenceCell
                        transactionId={row.lockedByTransactionId}
                        referenceCode={row.transactionReferenceCode}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.transactionCreatedAt
                        ? format(new Date(row.transactionCreatedAt), "yyyy-MM-dd hh:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {rowErrors[row.id] && (
                        <p className="text-xs text-destructive text-right mb-1">
                          {rowErrors[row.id]}
                        </p>
                      )}
                      {editingId === row.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => saveEdit(row.id)}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(row)}
                            title="Edit name and priority"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={row.isLocked}
                            onClick={() => handleToggleActive(row.id, row.isActive)}
                          >
                            {row.isActive ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={row.isLocked}
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteName(row.id)}
                            title={row.isLocked ? "Cannot delete a locked name" : "Delete"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            {names.length} name{names.length !== 1 ? "s" : ""}
            {" · "}
            {names.filter((r) => r.status === "available").length} available
            {" · "}
            {names.filter((r) => r.status === "locked").length} locked
            {" · "}
            {names.filter((r) => r.status === "inactive").length} inactive
          </p>
        </>
      )}

      <Dialog
        open={!!deleteListId}
        onOpenChange={(open) => {
          if (!open) setDeleteListId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Name List</DialogTitle>
            <DialogDescription>
              This will permanently delete the list and all its names. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteListError && <p className="text-sm text-destructive">{deleteListError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteListId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteListPending}
              onClick={handleDeleteList}
            >
              {deleteListPending ? "Deleting…" : "Delete List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Method Accordion
// ─────────────────────────────────────────────────────────────
function MethodAccordion({ method }: { method: MethodWithListsAndNames }) {
  const [open, setOpen] = useState(false);
  const [selectedListIdx, setSelectedListIdx] = useState(0);

  const selectedList = method.lists[selectedListIdx] ?? null;

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{method.name}</span>
          <Badge variant="outline" className="text-xs capitalize">
            {method.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {method.lists.length} list{method.lists.length !== 1 ? "s" : ""}
            {" · "}
            {method.lists.reduce((s, l) => s + l.nameCount, 0)} names
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t px-4 pb-4">
          {method.lists.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap pt-3">
              {method.lists.map((list, i) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedListIdx(i)}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    selectedListIdx === i
                      ? "bg-primary text-primary-foreground border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                  }`}
                >
                  List {i + 1}
                  <span className="ml-1.5 opacity-60 text-xs">
                    [{list.cashiers.map((c) => c.name).join(", ")}]
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedList && (
            <ListEditor
              key={selectedList.id}
              list={selectedList}
              names={selectedList.names}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root export
// ─────────────────────────────────────────────────────────────
export function NameListsView({ lockedNames, methodsForCreate, methodsWithLists }: Props) {
  return (
    <div className="space-y-6">
      <LockedNamesPanel lockedNames={lockedNames} />

      <CreateListPanel methodsForCreate={methodsForCreate} />

      {methodsWithLists.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Existing Lists
          </h2>
          {methodsWithLists.map((method) => (
            <MethodAccordion key={method.id} method={method} />
          ))}
        </div>
      )}
    </div>
  );
}
