"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Cashier } from "@/db/schema";
import { getAppUrl } from "@/lib/app-url";

const APP_URL = getAppUrl();

interface Props {
  cashier: Cashier;
}

export function ClerkCashierCard({ cashier }: Props) {
  const router = useRouter();
  const [visitLoading, setVisitLoading] = useState<"clerk" | "player" | null>(null);

  const cashierUrl = `${APP_URL.replace(/\/$/, "")}/${cashier.slug}/${cashier.token}/`;

  async function handleVisit(role: "clerk" | "player") {
    setVisitLoading(role);
    try {
      const res = await fetch("/api/master/visit-cashier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cashierId: cashier.id, role }),
      });
      const data = await res.json();
      if (data.redirect) {
        router.push(data.redirect);
        router.refresh();
      }
    } finally {
      setVisitLoading(null);
    }
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="pt-4 flex-1 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-base truncate">{cashier.name}</p>
          <span
            className={`text-xs font-medium ${cashier.isActive ? "text-green-600" : "text-muted-foreground"}`}
          >
            {cashier.isActive ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Slug</span>
          <code className="font-mono">{cashier.slug}</code>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Token</span>
          <code className="font-mono">{cashier.token}</code>
        </div>

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

      <CardFooter className="pt-2 pb-4 px-4">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleVisit("clerk")}
            disabled={visitLoading !== null || !cashier.isActive}
          >
            {visitLoading === "clerk" ? "Opening..." : "Visit as Clerk"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleVisit("player")}
            disabled={visitLoading !== null || !cashier.isActive}
          >
            {visitLoading === "player" ? "Opening..." : "Visit as Player"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
