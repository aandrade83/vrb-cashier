"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { MethodDepositPreview } from "@/components/method-deposit-preview";
import type { MethodWithFields } from "@/data/methods";

interface Props {
  deposits: MethodWithFields[];
  payouts: MethodWithFields[];
}

export function ClerkPlayerView({ deposits, payouts }: Props) {
  const [type, setType] = useState<"deposit" | "payout">("deposit");
  const [selected, setSelected] = useState<MethodWithFields | null>(null);

  const methods = type === "deposit" ? deposits : payouts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Player View</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click a card to preview exactly what players see when submitting a deposit.
          </p>
        </div>
        <Select
          value={type}
          onValueChange={(v) => { if (v !== null) setType(v as "deposit" | "payout"); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="deposit">Deposits</SelectItem>
            <SelectItem value="payout">Payouts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {methods.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">
          No active {type} methods.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {methods.map((method) => (
            <Card
              key={method.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelected(method)}
            >
              <CardContent className="flex flex-col items-center gap-3 p-6">
                {method.logoUrl ? (
                  <Image
                    src={method.logoUrl}
                    alt={method.name}
                    width={64}
                    height={64}
                    className="rounded object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center text-3xl">
                    💳
                  </div>
                )}
                <p className="font-medium text-center text-sm">{method.name}</p>
                <p className="text-xs text-muted-foreground">
                  {method.fields.length} field{method.fields.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <SheetTitle className="sr-only">{selected.name} — Player Preview</SheetTitle>
                <SheetDescription className="sr-only">
                  Preview of the deposit form as seen by players
                </SheetDescription>
              </SheetHeader>
              <div className="px-1 pb-6">
                <MethodDepositPreview method={selected} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
