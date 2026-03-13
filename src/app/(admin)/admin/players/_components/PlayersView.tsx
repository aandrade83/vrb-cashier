"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
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
import type { MethodWithFields } from "@/data/methods";

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Textarea",
  number: "Number",
  dropdown: "Dropdown",
  file: "File Upload",
  image: "Image Upload",
  date: "Date",
  checkbox: "Checkbox",
};

interface Props {
  deposits: MethodWithFields[];
  payouts: MethodWithFields[];
}

export function PlayersView({ deposits, payouts }: Props) {
  const [type, setType] = useState<"deposit" | "payout">("deposit");
  const [selected, setSelected] = useState<MethodWithFields | null>(null);

  const methods = type === "deposit" ? deposits : payouts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Player View Preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Click a card to preview its form fields.
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

      {/* Method detail sheet */}
      <Sheet open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  {selected.logoUrl ? (
                    <Image
                      src={selected.logoUrl}
                      alt={selected.name}
                      width={48}
                      height={48}
                      className="rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-2xl shrink-0">
                      💳
                    </div>
                  )}
                  <div>
                    <SheetTitle>{selected.name}</SheetTitle>
                    <SheetDescription className="capitalize">{selected.type}</SheetDescription>
                  </div>
                </div>
                {selected.description && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 text-sm text-blue-900 dark:text-blue-100">
                    {selected.description}
                  </div>
                )}
              </SheetHeader>

              <div className="px-4 pb-6 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Form Fields ({selected.fields.length})
                </p>
                {selected.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No fields defined for this method.</p>
                ) : (
                  selected.fields.map((field, i) => (
                    <div key={field.id} className="rounded-lg border p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {i + 1}. {field.label}
                            {field.isRequired && <span className="text-destructive ml-1">*</span>}
                          </p>
                          {field.placeholder && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Placeholder: {field.placeholder}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {FIELD_TYPE_LABELS[field.fieldType] ?? field.fieldType}
                        </Badge>
                      </div>
                      {field.fieldType === "dropdown" && Array.isArray(field.dropdownOptions) && (field.dropdownOptions as string[]).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {(field.dropdownOptions as string[]).map((opt) => (
                            <Badge key={opt} variant="secondary" className="text-xs">{opt}</Badge>
                          ))}
                        </div>
                      )}
                      {(field.fieldType === "file" || field.fieldType === "image") && (() => {
                        const fc = field.fileConfig as { maxSizeMb?: number; allowedExtensions?: string[] } | null;
                        if (!fc) return null;
                        const exts = fc.allowedExtensions ?? [];
                        return (
                          <p className="text-xs text-muted-foreground">
                            Max {fc.maxSizeMb ?? 5}MB{exts.length > 0 ? ` · ${exts.join(", ")}` : ""}
                          </p>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
