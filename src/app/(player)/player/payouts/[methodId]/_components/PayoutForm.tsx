"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { submitPayoutAction } from "../../actions";
import type { PaymentMethod, MethodField } from "@/db/schema";

type Props = {
  method: PaymentMethod;
  fields: MethodField[];
};

type FileUploadState = {
  uploading: boolean;
  url?: string;
  previewUrl?: string;
  error?: string;
};

type ValidationRules = {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
};

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

export function PayoutForm({ fields }: Props) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileState, setFileState] = useState<Record<string, FileUploadState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const amountField = fields.find((f) => f.label.toLowerCase().includes("amount"));

  function setValue(fieldId: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => ({ ...prev, [fieldId]: "" }));
  }

  async function handleFileChange(field: MethodField, file: File) {
    const fc = field.fileConfig as FileConfig | null;
    const maxMb = fc?.maxSizeMb ?? 2;

    if (file.size > maxMb * 1024 * 1024) {
      setFileState((prev) => ({
        ...prev,
        [field.id]: { uploading: false, error: `File too large. Max ${maxMb}MB.` },
      }));
      return;
    }

    setFileState((prev) => ({ ...prev, [field.id]: { uploading: true } }));

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();

    if (!res.ok) {
      setFileState((prev) => ({
        ...prev,
        [field.id]: { uploading: false, error: json.error ?? "Upload failed. Please try again." },
      }));
      return;
    }

    const previewUrl = field.fieldType === "image" ? URL.createObjectURL(file) : undefined;

    setFileState((prev) => ({
      ...prev,
      [field.id]: { uploading: false, url: json.url, previewUrl },
    }));
    setValue(field.id, json.url);
  }

  function validateAll(): boolean {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      const value = fieldValues[field.id] ?? "";
      const vr = field.validationRules as ValidationRules | null;

      if (field.isRequired && !value.trim()) {
        newErrors[field.id] = `${field.label} is required.`;
        continue;
      }

      if (!value.trim()) continue;

      if (vr?.minLength !== undefined && value.length < vr.minLength) {
        newErrors[field.id] = `Minimum ${vr.minLength} characters.`;
      } else if (vr?.maxLength !== undefined && value.length > vr.maxLength) {
        newErrors[field.id] = `Maximum ${vr.maxLength} characters.`;
      } else if (field.fieldType === "number") {
        const num = parseFloat(value);
        if (isNaN(num)) {
          newErrors[field.id] = "Must be a valid number.";
        } else if (vr?.min !== undefined && num < vr.min) {
          newErrors[field.id] = `Minimum value is ${vr.min}.`;
        } else if (vr?.max !== undefined && num > vr.max) {
          newErrors[field.id] = `Maximum value is ${vr.max}.`;
        }
      } else if (vr?.pattern) {
        const regex = new RegExp(vr.pattern);
        if (!regex.test(value)) {
          newErrors[field.id] = "Invalid format.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    if (!validateAll()) return;

    setSubmitting(true);

    const amountValue = amountField ? (fieldValues[amountField.id] ?? "0") : "0";

    const result = await submitPayoutAction({
      methodId: fields[0]?.methodId ?? "",
      fieldValues: fields
        .filter((f) => f.fieldType !== "label" && f.fieldType !== "hidden_label")
        .map((f) => ({
          methodFieldId: f.id,
          fieldLabelSnapshot: f.label,
          fieldTypeSnapshot: f.fieldType,
          value: fieldValues[f.id] ?? null,
        })),
      amount: amountValue,
      idempotencyKey: idempotencyKey.current,
      currency: "USD",
    });

    setSubmitting(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }

    router.push(`/player/transactions`);
  }

  const anyUploading = Object.values(fileState).some((s) => s.uploading);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => (
        <div key={field.id} className="space-y-1">
          {field.fieldType === "hidden_label" ? (
            <HiddenLabelField field={field} />
          ) : field.fieldType === "label" ? (
            <p className="text-sm font-medium">{field.label}</p>
          ) : (
            <>
              <Label htmlFor={field.id}>
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
                    id={field.id}
                    type="text"
                    placeholder={field.placeholder ?? undefined}
                    value={fieldValues[field.id] ?? ""}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={field === amountField ? "pl-6" : undefined}
                  />
                </div>
              )}

              {field.fieldType === "textarea" && (
                <textarea
                  id={field.id}
                  placeholder={field.placeholder ?? undefined}
                  value={fieldValues[field.id] ?? ""}
                  onChange={(e) => setValue(field.id, e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
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
                    id={field.id}
                    type="number"
                    placeholder={field.placeholder ?? undefined}
                    value={fieldValues[field.id] ?? ""}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    className={field === amountField ? "pl-6" : undefined}
                  />
                </div>
              )}

              {field.fieldType === "dropdown" && (
                <Select
                  value={fieldValues[field.id] ?? ""}
                  onValueChange={(v) => { if (v !== null) setValue(field.id, v); }}
                >
                  <SelectTrigger id={field.id}>
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
                  id={field.id}
                  type="date"
                  value={fieldValues[field.id] ?? ""}
                  onChange={(e) => setValue(field.id, e.target.value)}
                />
              )}

              {field.fieldType === "checkbox" && (
                <div className="flex items-center gap-2">
                  <input
                    id={field.id}
                    type="checkbox"
                    checked={fieldValues[field.id] === "true"}
                    onChange={(e) => setValue(field.id, e.target.checked ? "true" : "false")}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-muted-foreground">{field.placeholder ?? field.label}</span>
                </div>
              )}

              {(field.fieldType === "file" || field.fieldType === "image") && (
                <div className="space-y-2">
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
                        id={field.id}
                        type="file"
                        accept={accept}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileChange(field, file);
                        }}
                      />
                    );
                  })()}
                  {fileState[field.id]?.uploading && (
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  )}
                  {fileState[field.id]?.error && (
                    <p className="text-sm text-destructive">{fileState[field.id].error}</p>
                  )}
                  {field.fieldType === "image" && fileState[field.id]?.previewUrl && (
                    <Image
                      src={fileState[field.id].previewUrl!}
                      alt="Preview"
                      width={120}
                      height={120}
                      className="rounded border object-cover"
                    />
                  )}
                  {fileState[field.id]?.url && (
                    <p className="text-xs text-muted-foreground">✓ Uploaded successfully</p>
                  )}
                </div>
              )}

              {errors[field.id] && (
                <p className="text-sm text-destructive">{errors[field.id]}</p>
              )}
            </>
          )}
        </div>
      ))}

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      <Button type="submit" disabled={submitting || anyUploading} className="w-full sm:w-auto">
        {submitting ? "Submitting…" : "Submit Payout Request"}
      </Button>
    </form>
  );
}
