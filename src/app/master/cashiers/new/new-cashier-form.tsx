"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCashierAction } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  existingCashiers: { id: string; name: string }[];
}

export function NewCashierForm({ existingCashiers }: Props) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slug, setSlug] = useState("");
  const [cloneFrom, setCloneFrom] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await createCashierAction({
      name: form.get("name") as string,
      slug: (form.get("slug") as string).toLowerCase(),
      clientUrl: form.get("clientUrl") as string,
      contactEmail: form.get("contactEmail") as string,
      contactPhone: form.get("contactPhone") as string,
      cloneMethodsFrom: cloneFrom || undefined,
    });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="VRB Cashier" required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="vrb"
              maxLength={10}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              required
            />
            <p className="text-xs text-muted-foreground">
              Choose some initials as identifier (e.g. &quot;vrb&quot;). Always stored lowercase.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="clientUrl">Client Site URL</Label>
            <Input
              id="clientUrl"
              name="clientUrl"
              type="url"
              placeholder="https://client-site.com"
            />
            <p className="text-xs text-muted-foreground">
              The URL of the client&apos;s website where this cashier will be embedded.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactEmail">Contact Email (optional)</Label>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="contactPhone">Contact Phone (optional)</Label>
            <Input id="contactPhone" name="contactPhone" type="tel" />
          </div>

          {existingCashiers.length > 0 && (
            <div className="space-y-1">
              <Label>Load Methods from (optional)</Label>
              <Select
                value={cloneFrom}
                onValueChange={(v) => setCloneFrom(!v || v === "__none__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    {cloneFrom
                      ? (existingCashiers.find((c) => c.id === cloneFrom)?.name ?? cloneFrom)
                      : "Select a cashier to copy methods from"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {existingCashiers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Copies method assignments from the selected cashier into the new one.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create Cashier"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/master/dashboard")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
