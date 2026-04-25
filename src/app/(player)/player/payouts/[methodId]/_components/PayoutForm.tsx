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
import { submitPayoutAction } from "@/app/[slug]/[token]/player/payouts/actions";
import { requestNameAction } from "@/app/[slug]/[token]/player/name-actions";
import type { PaymentMethod, MethodField } from "@/db/schema";
import { buildPath } from "@/lib/paths";

type SubmitResult = { success: true; transactionId: string } | { success: false; error: string };

type Props = {
  method: PaymentMethod;
  fields: MethodField[];
  basePath?: string;
  submitAction?: (data: unknown) => Promise<SubmitResult>;
  onSuccess?: () => void;
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

const EXCLUDED_TYPES = ["label", "hidden_label", "address"] as const;
type ExcludedType = typeof EXCLUDED_TYPES[number];

function isExcluded(fieldType: string): fieldType is ExcludedType {
  return (EXCLUDED_TYPES as readonly string[]).includes(fieldType);
}

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

export function PayoutForm({ fields, basePath, submitAction, onSuccess }: Props) {
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());

  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileState, setFileState] = useState<Record<string, FileUploadState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [nameSelections, setNameSelections] = useState<
    Record<string, { nameId: string; value: string; blockingMode: "yes" | "no" } | null>
  >({});
  const [nameFetching, setNameFetching] = useState<Record<string, boolean>>({});
  const [nameUnavailable, setNameUnavailable] = useState<Record<string, boolean>>({});

  // Pick and lock one random value per random_list field on mount
  const [randomSelections] = useState<Record<string, string>>(() => {
    const selections: Record<string, string> = {};
    for (const field of fields) {
      if (field.fieldType === "random_list") {
        const options = field.dropdownOptions as string[] | null ?? [];
        if (options.length > 0) {
          selections[field.id] = options[Math.floor(Math.random() * options.length)];
        }
      }
    }
    return selections;
  });

  const amountField = fields.find((f) => f.label.toLowerCase().includes("amount"));

  function setValue(fieldId: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => ({ ...prev, [fieldId]: "" }));
  }

  async function handleGetName(fieldId: string, methodId: string) {
    setNameFetching((prev) => ({ ...prev, [fieldId]: true }));
    setErrors((prev) => ({ ...prev, [fieldId]: "" }));
    const result = await requestNameAction(methodId);
    setNameFetching((prev) => ({ ...prev, [fieldId]: false }));
    if (!result.success) {
      setErrors((prev) => ({ ...prev, [fieldId]: result.error }));
      setNameUnavailable((prev) => ({ ...prev, [fieldId]: true }));
      return;
    }
    setNameUnavailable((prev) => ({ ...prev, [fieldId]: false }));
    setNameSelections((prev) => ({
      ...prev,
      [fieldId]: { nameId: result.nameId, value: result.value, blockingMode: result.blockingMode },
    }));
  }

  function handleResetName(fieldId: string) {
    setNameSelections((prev) => ({ ...prev, [fieldId]: null }));
    setNameUnavailable((prev) => ({ ...prev, [fieldId]: false }));
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
    formData.append("methodFieldId", field.id);

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
      if (isExcluded(field.fieldType) || field.fieldType === "random_list") continue;
      if (field.fieldType === "name") {
        if (field.isRequired && !nameSelections[field.id]) {
          newErrors[field.id] = "Please get a name before submitting.";
        }
        continue;
      }
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

    const action = submitAction ?? submitPayoutAction;
    const result = await action({
      methodId: fields[0]?.methodId ?? "",
      fieldValues: fields
        .filter((f) => !isExcluded(f.fieldType))
        .map((f) => {
          if (f.fieldType === "name") {
            const sel = nameSelections[f.id];
            return {
              methodFieldId: f.id,
              fieldLabelSnapshot: f.label,
              fieldTypeSnapshot: f.fieldType,
              value: sel?.value ?? null,
              nameId: sel?.nameId ?? null,
            };
          }
          return {
            methodFieldId: f.id,
            fieldLabelSnapshot: f.label,
            fieldTypeSnapshot: f.fieldType,
            value: f.fieldType === "random_list" ? (randomSelections[f.id] ?? null) : (fieldValues[f.id] ?? null),
          };
        }),
      amount: amountValue,
      idempotencyKey: idempotencyKey.current,
      currency: "USD",
    });

    setSubmitting(false);

    if (!result.success) {
      setServerError(result.error);
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push(buildPath(basePath ?? "", "player", "transactions"));
    }
  }

  const anyUploading = Object.values(fileState).some((s) => s.uploading);
  const anyNameUnavailable = Object.values(nameUnavailable).some(Boolean);
  const anyRequiredNameMissing = fields
    .filter((f) => f.fieldType === "name" && f.isRequired)
    .some((f) => !nameSelections[f.id]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {fields.map((field) => {
        if (field.fieldType === "hyperlink") {
          const url = field.placeholder;
          if (!url) return null;
          return (
            <div key={field.id}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
              >
                {field.label}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            </div>
          );
        }
        if (field.fieldType === "name") {
          const sel = nameSelections[field.id];
          return (
            <div key={field.id} className="space-y-2">
              {!sel ? (
                <Button
                  type="button"
                  onClick={() => handleGetName(field.id, field.methodId)}
                  disabled={nameFetching[field.id]}
                  className="w-full sm:w-auto"
                >
                  {nameFetching[field.id] ? "Getting name…" : (field.placeholder ?? "Get Name")}
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm font-mono bg-muted rounded px-3 py-2 flex-1">{sel.value}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleResetName(field.id)}
                  >
                    Change
                  </Button>
                </div>
              )}
              {errors[field.id] && (
                <p className="text-sm text-destructive">{errors[field.id]}</p>
              )}
            </div>
          );
        }

        if (isExcluded(field.fieldType)) return null;

        return (
          <div key={field.id} className="space-y-1">
            {field.fieldType === "random_list" ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{field.label}</p>
                <p className="text-sm font-mono bg-muted rounded px-3 py-2 select-all break-all">
                  {randomSelections[field.id] ?? "—"}
                </p>
              </div>
            ) : (field.fieldType as string) === "hyperlink" ? (
              (() => {
                const url = field.placeholder;
                if (!url) return null;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                  >
                    {field.label}
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  </a>
                );
              })()
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
        );
      })}

      {serverError && (
        <p className="text-sm text-destructive">{serverError}</p>
      )}

      <Button type="submit" disabled={submitting || anyUploading || anyRequiredNameMissing || anyNameUnavailable} className="w-full sm:w-auto">
        {submitting ? "Submitting…" : "Submit Payout Request"}
      </Button>
    </form>
  );
}
