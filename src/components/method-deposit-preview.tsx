"use client";

import { useState } from "react";
import Image from "next/image";
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
import type { MethodWithFields } from "@/data/methods";
import type { MethodField } from "@/db/schema";

type FileConfig = {
  maxSizeMb?: number;
  allowedExtensions?: string[];
};

function HiddenLabelField({ field }: { field: MethodField }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-primary underline underline-offset-2 hover:no-underline"
      >
        {field.label}
      </button>
      {open && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{field.placeholder}</p>
      )}
    </div>
  );
}

interface Props {
  method: MethodWithFields;
}

export function MethodDepositPreview({ method }: Props) {
  const amountField = method.fields.find((f) =>
    f.label.toLowerCase().includes("amount")
  );

  return (
    <div className="space-y-6">
      {/* Header — same as player deposit page */}
      <div className="flex items-center gap-4">
        {method.logoUrl ? (
          <Image
            src={method.logoUrl}
            alt={method.name}
            width={56}
            height={56}
            className="rounded object-cover"
          />
        ) : (
          <div className="w-14 h-14 rounded bg-muted flex items-center justify-center text-2xl">
            💳
          </div>
        )}
        <h2 className="text-xl font-semibold">{method.name}</h2>
      </div>

      {method.description && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 text-sm text-blue-900 dark:text-blue-100">
          {method.description}
        </div>
      )}

      {/* Form fields — disabled, read-only */}
      <div className="space-y-5">
        {method.fields.map((field) => (
          <div key={field.id} className="space-y-1">
            {field.fieldType === "hidden_label" ? (
              <HiddenLabelField field={field} />
            ) : field.fieldType === "label" ? (
              <p className="text-sm font-medium">{field.label}</p>
            ) : (
              <>
                <Label htmlFor={`preview-${field.id}`}>
                  {field.label}
                  {field.isRequired && <span className="text-destructive ml-1">*</span>}
                </Label>

                {field.fieldType === "text" && (
                  <div className={field === amountField ? "relative" : undefined}>
                    {field === amountField && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                    )}
                    <Input
                      id={`preview-${field.id}`}
                      type="text"
                      placeholder={field.placeholder ?? undefined}
                      disabled
                      className={field === amountField ? "pl-6" : undefined}
                    />
                  </div>
                )}

                {field.fieldType === "textarea" && (
                  <textarea
                    id={`preview-${field.id}`}
                    placeholder={field.placeholder ?? undefined}
                    disabled
                    rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}

                {field.fieldType === "number" && (
                  <div className={field === amountField ? "relative" : undefined}>
                    {field === amountField && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        $
                      </span>
                    )}
                    <Input
                      id={`preview-${field.id}`}
                      type="number"
                      placeholder={field.placeholder ?? undefined}
                      disabled
                      className={field === amountField ? "pl-6" : undefined}
                    />
                  </div>
                )}

                {field.fieldType === "dropdown" && (
                  <Select disabled>
                    <SelectTrigger id={`preview-${field.id}`}>
                      <SelectValue placeholder={field.placeholder ?? "Select an option"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.dropdownOptions as string[] | null ?? []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {field.fieldType === "date" && (
                  <Input
                    id={`preview-${field.id}`}
                    type="date"
                    disabled
                  />
                )}

                {field.fieldType === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input
                      id={`preview-${field.id}`}
                      type="checkbox"
                      disabled
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-muted-foreground">
                      {field.placeholder ?? field.label}
                    </span>
                  </div>
                )}

                {(field.fieldType === "file" || field.fieldType === "image") && (
                  <div className="space-y-1">
                    {(() => {
                      const fc = field.fileConfig as FileConfig | null;
                      const exts = fc?.allowedExtensions ?? [];
                      const accept =
                        field.fieldType === "image"
                          ? "image/*"
                          : exts.length > 0
                          ? exts.map((e) => `.${e}`).join(",")
                          : "*/*";
                      return (
                        <Input
                          id={`preview-${field.id}`}
                          type="file"
                          accept={accept}
                          disabled
                        />
                      );
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <Button type="button" disabled className="w-full sm:w-auto">
        Submit Deposit Request
      </Button>
    </div>
  );
}
