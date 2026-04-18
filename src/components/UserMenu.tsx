"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface UserMenuProps {
  username: string;
  slug?: string;
  token?: string;
}

export function UserMenu({ username, slug, token }: UserMenuProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, token }),
      });
      const data = await res.json();
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{username}</span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? "Signing out..." : "Sign Out"}
      </Button>
    </div>
  );
}
