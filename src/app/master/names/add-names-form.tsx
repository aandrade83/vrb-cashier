"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createNameAction, createNamesBulkAction } from "./actions";

interface Props {
  cashierId: string;
}

export function AddNamesForm({ cashierId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [value, setValue] = useState("");
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSingle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const result = await createNameAction(cashierId, value);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setValue("");
    router.refresh();
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    const result = await createNamesBulkAction(cashierId, bulk);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setBulk("");
    router.refresh();
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex gap-2">
        {(["single", "bulk"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1 text-sm rounded-md ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {t === "single" ? "Add Single" : "Bulk Import"}
          </button>
        ))}
      </div>

      {tab === "single" ? (
        <form onSubmit={handleSingle} className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="name-value">Name</Label>
            <Input
              id="name-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. John Smith"
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleBulk} className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="bulk-names">One name per line</Label>
            <textarea
              id="bulk-names"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              rows={6}
              placeholder={"John Smith\nMaria Garcia\nDavid Lee"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Importing…" : "Import"}
          </Button>
        </form>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
