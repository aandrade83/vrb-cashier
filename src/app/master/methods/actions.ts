"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createGlobalMethod,
  updateGlobalMethod,
  toggleGlobalMethodActive,
  deleteGlobalMethod,
  getGlobalMethodById,
} from "@/data/methods";
import { isMasterAuthenticated } from "@/lib/master-auth";

type ActionResult = { success: true; methodId?: string } | { success: false; error: string };

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  placeholder: z.string().optional().nullable(),
  fieldType: z.enum([
    "text", "textarea", "number", "dropdown", "file", "image", "date",
    "checkbox", "label", "hidden_label", "random_list", "amount_list",
    "hyperlink", "name", "address",
  ]),
  isRequired: z.boolean(),
  displayOrder: z.number().int().min(0),
  dropdownOptions: z.array(z.string()).optional().nullable(),
  fileConfig: z
    .object({
      maxSizeMb: z.number().optional(),
      allowedExtensions: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
  validationRules: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional()
    .nullable(),
});

const methodSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["deposit", "payout"]),
  description: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  isActive: z.boolean(),
  fields: z.array(fieldSchema),
});

async function requireMaster(): Promise<true | { error: string }> {
  const ok = await isMasterAuthenticated();
  if (!ok) return { error: "Unauthorized" };
  return true;
}

export async function createGlobalMethodAction(data: unknown): Promise<ActionResult> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  const parsed = methodSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const methodId = await createGlobalMethod({
    ...parsed.data,
    logoUrl: parsed.data.logoUrl || null,
  });

  revalidatePath("/master/methods");
  return { success: true, methodId };
}

export async function updateGlobalMethodAction(id: string, data: unknown): Promise<ActionResult> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  const existing = await getGlobalMethodById(id);
  if (!existing) return { success: false, error: "Method not found" };

  const parsed = methodSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await updateGlobalMethod(id, {
    ...parsed.data,
    logoUrl: parsed.data.logoUrl || null,
  });

  revalidatePath("/master/methods");
  return { success: true };
}

export async function toggleGlobalMethodActiveAction(id: string): Promise<ActionResult> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  await toggleGlobalMethodActive(id);
  revalidatePath("/master/methods");
  return { success: true };
}

type DeleteResult =
  | { success: true; deleted: true }
  | { success: true; deleted: false; deactivated: true }
  | { success: false; error: string };

export async function deleteGlobalMethodAction(id: string): Promise<DeleteResult> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  const result = await deleteGlobalMethod(id);
  revalidatePath("/master/methods");

  if (result.deleted) return { success: true, deleted: true };
  return { success: true, deleted: false, deactivated: true };
}
