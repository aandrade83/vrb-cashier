"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Card, CardContent } from "@/components/ui/card";
import { createMasterUserAction } from "./actions";

export function CreateMasterUserForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"master_admin" | "master_clerk">("master_clerk");
  const [mustReset, setMustReset] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const result = await createMasterUserAction({
      email,
      password: (form.elements.namedItem("password") as HTMLInputElement).value,
      role,
      mustResetPassword: mustReset,
    });

    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    router.push("/master/users");
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Initial Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as "master_admin" | "master_clerk")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master_clerk">Master Clerk</SelectItem>
                <SelectItem value="master_admin">Master Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mustReset}
              onChange={(e) => setMustReset(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm">Require password reset on first login</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create User"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/master/users")}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
