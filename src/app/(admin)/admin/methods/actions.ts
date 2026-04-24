"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createMethod,
  updateMethod,
  toggleMethodActive,
  getMethodById,
} from "@/data/methods";
import { getCashierId } from "@/lib/cashier-context";
import { getSessionForCashier } from "@/lib/auth/session";
import { db } from "@/db";
import { paymentMethods, transactions } from "@/db/schema";
import { and, eq, inArray, count } from "drizzle-orm";

type ActionResult = { success: true; methodId?: string } | { success: false; error: string };

const fieldSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1),
  placeholder: z.string().optional().nullable(),
  fieldType: z.enum(["text", "textarea", "number", "dropdown", "file", "image", "date", "checkbox", "label", "hidden_label", "random_list", "amount_list", "hyperlink", "name", "address"]),
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
  activateNumber: z.number().int().min(1).default(1),
  fields: z.array(fieldSchema),
});

async function requireAdmin(cashierId: string): Promise<{ adminDbId: string } | { error: string }> {
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") return { error: "Unauthorized" };
  if (!access.userId) return { error: "Master session cannot perform this action directly. Use tenant admin panel." };
  return { adminDbId: access.userId };
}

export async function createMethodAction(data: unknown): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const adminAuth = await requireAdmin(cashierId);
  if ("error" in adminAuth) return { success: false, error: adminAuth.error };

  const parsed = methodSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const methodId = await createMethod(
    {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl || null,
    },
    adminAuth.adminDbId,
    cashierId
  );

  revalidatePath("/admin/methods");
  return { success: true, methodId };
}

export async function updateMethodAction(id: string, data: unknown): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const adminAuth = await requireAdmin(cashierId);
  if ("error" in adminAuth) return { success: false, error: adminAuth.error };

  const existing = await getMethodById(id, cashierId);
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
    adminAuth.adminDbId,
    cashierId
  );

  revalidatePath("/admin/methods");
  return { success: true };
}

type DeleteResult =
  | { success: true; deleted: true }
  | { success: true; deleted: false; deactivated: true }
  | { success: false; error: string };

export async function deleteMethodAction(data: { id: string }): Promise<DeleteResult> {
  const cashierId = await getCashierId();
  const adminAuth = await requireAdmin(cashierId);
  if ("error" in adminAuth) return { success: false, error: adminAuth.error };

  const [historyRow] = await db
    .select({ count: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.methodId, data.id),
        eq(transactions.cashierId, cashierId),
        inArray(transactions.status, ["preconfirmed", "postconfirmed", "denied", "completed"])
      )
    );

  const hasHistory = Number(historyRow?.count ?? 0) > 0;

  if (hasHistory) {
    await db
      .update(paymentMethods)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(paymentMethods.id, data.id), eq(paymentMethods.cashierId, cashierId)));
    revalidatePath("/admin/methods");
    return { success: true, deleted: false, deactivated: true };
  }

  await db
    .update(paymentMethods)
    .set({ isDeleted: true, isActive: false, updatedAt: new Date() })
    .where(and(eq(paymentMethods.id, data.id), eq(paymentMethods.cashierId, cashierId)));
  revalidatePath("/admin/methods");
  return { success: true, deleted: true };
}

export async function toggleMethodActiveAction(data: { id: string }): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const adminAuth = await requireAdmin(cashierId);
  if ("error" in adminAuth) return { success: false, error: adminAuth.error };

  if (!data.id) return { success: false, error: "Missing method ID" };

  await toggleMethodActive(data.id, adminAuth.adminDbId, cashierId);
  revalidatePath("/admin/methods");
  return { success: true };
}
