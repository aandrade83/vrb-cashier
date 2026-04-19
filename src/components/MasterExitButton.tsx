"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MasterExitButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExit() {
    setLoading(true);
    try {
      const res = await fetch("/api/master/exit-cashier", { method: "POST" });
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleExit}
      disabled={loading}
      className="text-amber-800 border-amber-300 hover:bg-amber-100"
    >
      {loading ? "Exiting..." : "Exit Cashier"}
    </Button>
  );
}
