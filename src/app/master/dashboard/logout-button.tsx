"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MasterLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/master/logout", { method: "POST" });
    router.push("/master/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
