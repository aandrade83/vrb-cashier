"use client";

import { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { updateMethodAction } from "../../actions";
import type { MethodWithFields } from "@/data/methods";
import type { MethodField } from "@/db/schema";

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "dropdown"
  | "file"
  | "image"
  | "date"
  | "checkbox"
  | "label"
  | "hidden_label"
  | "random_list";

type FieldDef = {
  id: string;
  label: string;
  placeholder: string;
  fieldType: FieldType;
  isRequired: boolean;
  displayOrder: number;
  dropdownOptions: string[];
  fileConfig: { maxSizeMb: number; allowedExtensions: string[] };
  validationRules: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string };
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  textarea: "Textarea",
  number: "Number",
  dropdown: "Dropdown",
  file: "File Upload",
  image: "Image Upload",
  date: "Date",
  checkbox: "Checkbox",
  label: "Label",
  hidden_label: "Hidden Label",
  random_list: "Random List",
};

const EXTENSION_OPTIONS = ["jpg", "jpeg", "png", "pdf", "webp", "gif"];

function dbFieldToFieldDef(f: MethodField): FieldDef {
  const fc = f.fileConfig as { maxSizeMb?: number; allowedExtensions?: string[] } | null;
  const vr = f.validationRules as { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string } | null;
  return {
    id: f.id,
    label: f.label,
    placeholder: f.placeholder ?? "",
    fieldType: f.fieldType as FieldType,
    isRequired: f.isRequired,
    displayOrder: f.displayOrder,
    dropdownOptions: Array.isArray(f.dropdownOptions) ? (f.dropdownOptions as string[]) : [],
    fileConfig: { maxSizeMb: fc?.maxSizeMb ?? 5, allowedExtensions: fc?.allowedExtensions ?? [] },
    validationRules: vr ?? {},
  };
}

function newField(order: number): FieldDef {
  return {
    id: crypto.randomUUID(),
    label: "",
    placeholder: "",
    fieldType: "text",
    isRequired: true,
    displayOrder: order,
    dropdownOptions: [],
    fileConfig: { maxSizeMb: 5, allowedExtensions: ["jpg", "png"] },
    validationRules: {},
  };
}

export function EditMethodForm({ method }: { method: MethodWithFields }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(method.name);
  const [type, setType] = useState<"deposit" | "payout">(method.type);
  const [description, setDescription] = useState(method.description ?? "");
  const [logoUrl, setLogoUrl] = useState(method.logoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);

  const [fields, setFields] = useState<FieldDef[]>(method.fields.map(dbFieldToFieldDef));
  const [addingField, setAddingField] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [draftField, setDraftField] = useState<FieldDef>(() => newField(method.fields.length));
  const [newOption, setNewOption] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  const [isActive, setIsActive] = useState(method.isActive);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (res.ok) setLogoUrl(json.url);
    else setError(json.error ?? "Logo upload failed");
    setLogoUploading(false);
  }

  function startAddField() {
    setDraftField(newField(fields.length));
    setNewOption("");
    setShowValidation(false);
    setEditingFieldId(null);
    setAddingField(true);
  }

  function startEditField(field: FieldDef) {
    setDraftField({ ...field });
    setNewOption("");
    setShowValidation(false);
    setEditingFieldId(field.id);
    setAddingField(true);
  }

  function commitField() {
    if (!draftField.label.trim()) return;
    if (editingFieldId) {
      setFields((prev) =>
        prev.map((f) => (f.id === editingFieldId ? { ...draftField, displayOrder: f.displayOrder } : f))
      );
      setEditingFieldId(null);
    } else {
      setFields((prev) => [...prev, { ...draftField, displayOrder: prev.length }]);
    }
    setAddingField(false);
  }

  function removeField(id: string) {
    setFields((prev) =>
      prev.filter((f) => f.id !== id).map((f, i) => ({ ...f, displayOrder: i }))
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    const newFields = [...fields];
    const target = index + direction;
    if (target < 0 || target >= newFields.length) return;
    [newFields[index], newFields[target]] = [newFields[target], newFields[index]];
    setFields(newFields.map((f, i) => ({ ...f, displayOrder: i })));
  }

  function addDropdownOption() {
    if (!newOption.trim()) return;
    setDraftField((prev) => ({ ...prev, dropdownOptions: [...prev.dropdownOptions, newOption.trim()] }));
    setNewOption("");
  }

  function removeDropdownOption(opt: string) {
    setDraftField((prev) => ({ ...prev, dropdownOptions: prev.dropdownOptions.filter((o) => o !== opt) }));
  }

  function toggleExtension(ext: string) {
    setDraftField((prev) => {
      const exts = prev.fileConfig.allowedExtensions;
      return {
        ...prev,
        fileConfig: {
          ...prev.fileConfig,
          allowedExtensions: exts.includes(ext) ? exts.filter((e) => e !== ext) : [...exts, ext],
        },
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const result = await updateMethodAction(method.id, {
      name,
      type,
      description: description || null,
      logoUrl: logoUrl || null,
      isActive,
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        placeholder: f.placeholder || null,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        displayOrder: f.displayOrder,
        dropdownOptions: f.dropdownOptions.length > 0 ? f.dropdownOptions : null,
        fileConfig: f.fieldType === "file" || f.fieldType === "image" ? f.fileConfig : null,
        validationRules: Object.keys(f.validationRules).length > 0 ? f.validationRules : null,
      })),
    });

    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push(`/admin/methods?type=${type}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* Section A */}
      <Card>
        <CardHeader><CardTitle>Method Info</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Type *</Label>
            <Select value={type} onValueChange={(v) => setType(v as "deposit" | "payout")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="payout">Payout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
            />
          </div>
          <div className="space-y-1">
            <Label>Logo (JPG, PNG, WebP — max 2MB)</Label>
            <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoChange} disabled={logoUploading} />
            {logoUploading && <p className="text-sm text-muted-foreground">Uploading…</p>}
            {logoUrl && (
              <Image src={logoUrl} alt="Logo preview" width={80} height={80} className="mt-2 rounded border object-cover" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section B */}
      <Card>
        <CardHeader><CardTitle>Form Fields</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {fields.length > 0 && (
            <div className="space-y-2">
              {fields.map((field, index) => {
                const isEditing = editingFieldId === field.id;
                if (isEditing) {
                  return (
                    <div key={field.id} className="rounded border p-4 space-y-3 bg-muted/30">
                      <div className={`grid gap-3 ${draftField.fieldType === "label" ? "grid-cols-1" : "grid-cols-2"}`}>
                        <div className="space-y-1">
                          <Label>{draftField.fieldType === "hidden_label" ? "Toggle Label *" : "Label *"}</Label>
                          <Input
                            value={draftField.label}
                            onChange={(e) => setDraftField((prev) => ({ ...prev, label: e.target.value }))}
                            placeholder={draftField.fieldType === "hidden_label" ? 'e.g. "See more"' : "e.g. Card Number"}
                          />
                        </div>
                        {draftField.fieldType !== "label" && (
                          <div className="space-y-1">
                            <Label>{draftField.fieldType === "hidden_label" ? "Content (shown when expanded)" : "Placeholder"}</Label>
                            {draftField.fieldType === "hidden_label" ? (
                              <textarea
                                value={draftField.placeholder}
                                onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))}
                                rows={8}
                                placeholder="Enter the full text content that will be shown when expanded…"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                              />
                            ) : (
                              <Input value={draftField.placeholder} onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))} placeholder="Optional hint text" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label>Field Type</Label>
                          <Select
                            value={draftField.fieldType}
                            onValueChange={(v) =>
                              setDraftField((prev) => ({
                                ...prev,
                                fieldType: v as FieldType,
                                isRequired: (v === "label" || v === "hidden_label" || v === "random_list") ? false : prev.isRequired,
                              }))
                            }
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([val, lbl]) => (
                                <SelectItem key={val} value={val}>{lbl}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!(draftField.fieldType === "label" || draftField.fieldType === "hidden_label" || draftField.fieldType === "random_list") && (
                          <div className="flex items-center gap-2 pt-6">
                            <input type="checkbox" id={`editIsRequired-${field.id}`} checked={draftField.isRequired} onChange={(e) => setDraftField((prev) => ({ ...prev, isRequired: e.target.checked }))} className="h-4 w-4" />
                            <Label htmlFor={`editIsRequired-${field.id}`}>Required</Label>
                          </div>
                        )}
                      </div>
                      {draftField.fieldType === "random_list" && (
                        <div className="space-y-2">
                          <Label>List Values</Label>
                          <p className="text-xs text-muted-foreground">
                            One will be picked at random each time a player opens this form.
                          </p>
                          <div className="flex gap-2">
                            <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Add value (e.g. Bitcoin address)" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }} />
                            <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {draftField.dropdownOptions.map((opt) => (
                              <Badge key={opt} variant="secondary" className="gap-1 font-mono text-xs">
                                {opt}
                                <button type="button" onClick={() => removeDropdownOption(opt)} className="text-xs hover:text-destructive">✕</button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {draftField.fieldType === "dropdown" && (
                        <div className="space-y-2">
                          <Label>Dropdown Options</Label>
                          <div className="flex gap-2">
                            <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Add option" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }} />
                            <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>Add</Button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {draftField.dropdownOptions.map((opt) => (
                              <Badge key={opt} variant="secondary" className="gap-1">
                                {opt}
                                <button type="button" onClick={() => removeDropdownOption(opt)} className="text-xs hover:text-destructive">✕</button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(draftField.fieldType === "file" || draftField.fieldType === "image") && (
                        <div className="space-y-2">
                          <Label>File Config</Label>
                          <div className="flex items-center gap-2">
                            <Label className="text-sm whitespace-nowrap">Max size (MB)</Label>
                            <Input type="number" min={1} max={50} value={draftField.fileConfig.maxSizeMb} onChange={(e) => setDraftField((prev) => ({ ...prev, fileConfig: { ...prev.fileConfig, maxSizeMb: Number(e.target.value) } }))} className="w-20" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {EXTENSION_OPTIONS.map((ext) => (
                              <label key={ext} className="flex items-center gap-1 text-sm">
                                <input type="checkbox" checked={draftField.fileConfig.allowedExtensions.includes(ext)} onChange={() => toggleExtension(ext)} className="h-3 w-3" />
                                {ext}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {!(draftField.fieldType === "label" || draftField.fieldType === "hidden_label" || draftField.fieldType === "random_list") && (
                        <div>
                          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowValidation((v) => !v)}>
                            {showValidation ? "▼" : "▶"} Validation Rules (optional)
                          </button>
                          {showValidation && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {(draftField.fieldType === "text" || draftField.fieldType === "textarea") && (
                                <>
                                  <div className="space-y-1"><Label className="text-xs">Min length</Label><Input type="number" min={0} value={draftField.validationRules.minLength ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, minLength: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                                  <div className="space-y-1"><Label className="text-xs">Max length</Label><Input type="number" min={0} value={draftField.validationRules.maxLength ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, maxLength: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                                  <div className="col-span-2 space-y-1"><Label className="text-xs">Pattern (regex)</Label><Input value={draftField.validationRules.pattern ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, pattern: e.target.value || undefined } }))} placeholder="e.g. ^[0-9]{16}$" /></div>
                                </>
                              )}
                              {draftField.fieldType === "number" && (
                                <>
                                  <div className="space-y-1"><Label className="text-xs">Min value</Label><Input type="number" value={draftField.validationRules.min ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, min: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                                  <div className="space-y-1"><Label className="text-xs">Max value</Label><Input type="number" value={draftField.validationRules.max ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, max: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <Separator />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={commitField}>Save Changes</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => { setAddingField(false); setEditingFieldId(null); }}>Cancel</Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={field.id} className="flex items-center gap-2 rounded border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{field.label}</span>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">{FIELD_TYPE_LABELS[field.fieldType]}</Badge>
                        {field.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveField(index, -1)} disabled={index === 0 || !!editingFieldId}>↑</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1 || !!editingFieldId}>↓</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEditField(field)} disabled={!!editingFieldId || addingField} title="Edit field">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeField(field.id)} disabled={!!editingFieldId || addingField}>✕</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {addingField && !editingFieldId ? (
            <div className="rounded border p-4 space-y-3 bg-muted/30">
              <div className={`grid gap-3 ${draftField.fieldType === "label" ? "grid-cols-1" : "grid-cols-2"}`}>
                <div className="space-y-1">
                  <Label>
                    {draftField.fieldType === "hidden_label" ? "Toggle Label *" : "Label *"}
                  </Label>
                  <Input
                    value={draftField.label}
                    onChange={(e) => setDraftField((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder={draftField.fieldType === "hidden_label" ? 'e.g. "See more"' : "e.g. Card Number"}
                  />
                </div>
                {draftField.fieldType !== "label" && (
                  <div className="space-y-1">
                    <Label>
                      {draftField.fieldType === "hidden_label" ? "Content (shown when expanded)" : "Placeholder"}
                    </Label>
                    {draftField.fieldType === "hidden_label" ? (
                      <textarea
                        value={draftField.placeholder}
                        onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))}
                        rows={8}
                        placeholder="Enter the full text content that will be shown when expanded…"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                      />
                    ) : (
                      <Input value={draftField.placeholder} onChange={(e) => setDraftField((prev) => ({ ...prev, placeholder: e.target.value }))} placeholder="Optional hint text" />
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Field Type</Label>
                  <Select
                    value={draftField.fieldType}
                    onValueChange={(v) =>
                      setDraftField((prev) => ({
                        ...prev,
                        fieldType: v as FieldType,
                        isRequired: (v === "label" || v === "hidden_label" || v === "random_list") ? false : prev.isRequired,
                      }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([val, lbl]) => (
                        <SelectItem key={val} value={val}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!(draftField.fieldType === "label" || draftField.fieldType === "hidden_label" || draftField.fieldType === "random_list") && (
                  <div className="flex items-center gap-2 pt-6">
                    <input type="checkbox" id="editIsRequired" checked={draftField.isRequired} onChange={(e) => setDraftField((prev) => ({ ...prev, isRequired: e.target.checked }))} className="h-4 w-4" />
                    <Label htmlFor="editIsRequired">Required</Label>
                  </div>
                )}
              </div>

              {draftField.fieldType === "random_list" && (
                <div className="space-y-2">
                  <Label>List Values</Label>
                  <p className="text-xs text-muted-foreground">
                    One will be picked at random each time a player opens this form.
                  </p>
                  <div className="flex gap-2">
                    <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Add value (e.g. Bitcoin address)" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {draftField.dropdownOptions.map((opt) => (
                      <Badge key={opt} variant="secondary" className="gap-1 font-mono text-xs">
                        {opt}
                        <button type="button" onClick={() => removeDropdownOption(opt)} className="text-xs hover:text-destructive">✕</button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {draftField.fieldType === "dropdown" && (
                <div className="space-y-2">
                  <Label>Dropdown Options</Label>
                  <div className="flex gap-2">
                    <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Add option" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }} />
                    <Button type="button" variant="outline" size="sm" onClick={addDropdownOption}>Add</Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {draftField.dropdownOptions.map((opt) => (
                      <Badge key={opt} variant="secondary" className="gap-1">
                        {opt}
                        <button type="button" onClick={() => removeDropdownOption(opt)} className="text-xs hover:text-destructive">✕</button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(draftField.fieldType === "file" || draftField.fieldType === "image") && (
                <div className="space-y-2">
                  <Label>File Config</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm whitespace-nowrap">Max size (MB)</Label>
                    <Input type="number" min={1} max={50} value={draftField.fileConfig.maxSizeMb} onChange={(e) => setDraftField((prev) => ({ ...prev, fileConfig: { ...prev.fileConfig, maxSizeMb: Number(e.target.value) } }))} className="w-20" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {EXTENSION_OPTIONS.map((ext) => (
                      <label key={ext} className="flex items-center gap-1 text-sm">
                        <input type="checkbox" checked={draftField.fileConfig.allowedExtensions.includes(ext)} onChange={() => toggleExtension(ext)} className="h-3 w-3" />
                        {ext}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {!(draftField.fieldType === "label" || draftField.fieldType === "hidden_label" || draftField.fieldType === "random_list") && <div>
                <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowValidation((v) => !v)}>
                  {showValidation ? "▼" : "▶"} Validation Rules (optional)
                </button>
                {showValidation && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {(draftField.fieldType === "text" || draftField.fieldType === "textarea") && (
                      <>
                        <div className="space-y-1"><Label className="text-xs">Min length</Label><Input type="number" min={0} value={draftField.validationRules.minLength ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, minLength: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Max length</Label><Input type="number" min={0} value={draftField.validationRules.maxLength ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, maxLength: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                        <div className="col-span-2 space-y-1"><Label className="text-xs">Pattern (regex)</Label><Input value={draftField.validationRules.pattern ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, pattern: e.target.value || undefined } }))} placeholder="e.g. ^[0-9]{16}$" /></div>
                      </>
                    )}
                    {draftField.fieldType === "number" && (
                      <>
                        <div className="space-y-1"><Label className="text-xs">Min value</Label><Input type="number" value={draftField.validationRules.min ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, min: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Max value</Label><Input type="number" value={draftField.validationRules.max ?? ""} onChange={(e) => setDraftField((prev) => ({ ...prev, validationRules: { ...prev.validationRules, max: e.target.value ? Number(e.target.value) : undefined } }))} /></div>
                      </>
                    )}
                  </div>
                )}
              </div>}

              <Separator />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={commitField}>Add Field</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => { setAddingField(false); setEditingFieldId(null); }}>Cancel</Button>
              </div>
            </div>
          ) : !editingFieldId && (
            <Button type="button" variant="outline" onClick={startAddField}>+ Add Field</Button>
          )}
        </CardContent>
      </Card>

      {/* Section C */}
      <Card>
        <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
        <CardContent>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4" />
            <span className="text-sm">Active — players can see and use this method</span>
          </label>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || logoUploading}>
          {pending ? "Saving…" : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(`/admin/methods?type=${type}`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
