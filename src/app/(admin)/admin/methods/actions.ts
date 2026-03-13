"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createMethod,
  updateMethod,
  toggleMethodActive,
  getMethodById,
} from "@/data/methods";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type ActionResult = { success: true; methodId?: string } | { success: false; error: string };

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  placeholder: z.string().optional().nullable(),
  fieldType: z.enum(["text", "textarea", "number", "dropdown", "file", "image", "date", "checkbox", "label", "hidden_label"]),
  isRequired: z.boolean(),
  displayOrder: z.number().int().min(0),
  dropdownOptions: z.array(z.string()).optional().nullable(),
  fileConfig: z
    .object({ maxSizeMb: z.number().optional(), allowedExtensions: z.array(z.string()).optional() })
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

async function requireAdmin(): Promise<{ adminDbId: string } | { error: string }> {
  const { sessionClaims, userId } = await auth();
  if (sessionClaims?.public_metadata?.role !== "admin" || !userId) {
    return { error: "Unauthorized" };
  }

  const [adminRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!adminRecord) return { error: "Admin record not found" };
  return { adminDbId: adminRecord.id };
}

export async function createMethodAction(data: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  const parsed = methodSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const methodId = await createMethod(
    {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl || null,
    },
    auth.adminDbId
  );

  revalidatePath("/admin/methods");
  return { success: true, methodId };
}

export async function updateMethodAction(id: string, data: unknown): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  const existing = await getMethodById(id);
  if (!existing) return { success: false, error: "Method not found" };

  const parsed = methodSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  await updateMethod(
    id,
    {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl || null,
    },
    auth.adminDbId
  );

  revalidatePath("/admin/methods");
  return { success: true };
}

export async function toggleMethodActiveAction(data: { id: string }): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) return { success: false, error: auth.error };

  if (!data.id) return { success: false, error: "Missing method ID" };

  await toggleMethodActive(data.id, auth.adminDbId);
  revalidatePath("/admin/methods");
  return { success: true };
}
