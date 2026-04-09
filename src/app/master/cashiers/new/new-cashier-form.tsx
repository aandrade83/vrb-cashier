"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCashierAction } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function NewCashierForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const result = await createCashierAction({
      name: form.get("name") as string,
      slug: form.get("slug") as string,
      contactEmail: form.get("contactEmail") as string,
      contactPhone: form.get("contactPhone") as string,
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
            <Label htmlFor="slug">Slug (2-10 chars, lowercase)</Label>
            <Input
              id="slug"
              name="slug"
              placeholder="vrb"
              maxLength={10}
              pattern="[a-z0-9]+"
              required
            />
            <p className="text-xs text-muted-foreground">
              Used in the URL: /slug/token/...
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

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creating..." : "Create Cashier"}
            </Button>
            <button
              type="button"
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
              onClick={() => router.push("/master/dashboard")}
            >
              Cancel
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
