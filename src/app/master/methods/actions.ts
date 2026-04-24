"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import {
  createGlobalMethod,
  updateGlobalMethod,
  toggleGlobalMethodActive,
  deleteGlobalMethod,
  getGlobalMethodById,
} from "@/data/methods";
import { isMasterAuthenticated, getMasterSessionData, getMasterSessionFromCookies } from "@/lib/master-auth";
import { db } from "@/db";
import { cashierUsers, transactions, transactionFieldValues, masterUsers } from "@/db/schema";
import { getCashierBySlug } from "@/data/cashiers";
import { getNextTransactionSequence, findTransactionByIdempotencyKey } from "@/data/transactions";
import type { MethodWithFields } from "@/data/methods";

type ActionResult = { success: true; methodId?: string } | { success: false; error: string };
type PreviewActionResult = { success: true; transactionId: string } | { success: false; error: string };

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
  activateNumber: z.number().int().min(1).default(1),
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

export async function getMethodPreviewAction(
  id: string,
): Promise<{ success: true; method: MethodWithFields } | { success: false; error: string }> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  const method = await getGlobalMethodById(id);
  if (!method) return { success: false, error: "Method not found." };

  return { success: true, method };
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

const previewFieldValueSchema = z.object({
  methodFieldId: z.string().uuid(),
  fieldLabelSnapshot: z.string().min(1),
  fieldTypeSnapshot: z.enum([
    "text", "textarea", "number", "dropdown", "file", "image",
    "date", "checkbox", "label", "hidden_label", "random_list",
    "amount_list", "hyperlink", "name", "address",
  ]),
  value: z.string().nullable(),
});

const previewSubmitSchema = z.object({
  methodId: z.string().uuid(),
  fieldValues: z.array(previewFieldValueSchema),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  idempotencyKey: z.string().uuid(),
  currency: z.string().default("USD"),
});

export async function submitPreviewTransactionAction(data: unknown): Promise<PreviewActionResult> {
  const auth = await requireMaster();
  if (auth !== true) return { success: false, error: auth.error };

  const vrbCashier = await getCashierBySlug("vrb");
  if (!vrbCashier) return { success: false, error: "VRB test cashier not configured." };
  const cashierId = vrbCashier.id;

  // Resolve master username to build the __mp__ shadow player name
  const sessionToken = await getMasterSessionFromCookies();
  const session = sessionToken ? await getMasterSessionData(sessionToken) : null;
  let masterUsername = "root";
  if (session?.masterUserId) {
    const [mu] = await db
      .select({ username: masterUsers.username })
      .from(masterUsers)
      .where(eq(masterUsers.id, session.masterUserId))
      .limit(1);
    masterUsername = mu?.username ?? "root";
  }
  const previewUsername = `__mp__${masterUsername}`;

  // Get or create the preview player in VRB cashier
  let playerId: string;
  const [existingPlayer] = await db
    .select({ id: cashierUsers.id })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.cashierId, cashierId), eq(cashierUsers.username, previewUsername)))
    .limit(1);

  if (existingPlayer) {
    playerId = existingPlayer.id;
  } else {
    const [newPlayer] = await db
      .insert(cashierUsers)
      .values({
        cashierId,
        username: previewUsername,
        passwordHash: "!disabled",
        role: "player",
        firstName: "Preview",
        lastName: null,
        emailVerified: true,
        isActive: true,
      })
      .returning({ id: cashierUsers.id });
    playerId = newPlayer.id;
  }

  const parsed = previewSubmitSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { methodId, fieldValues, amount, idempotencyKey, currency } = parsed.data;

  const existing = await findTransactionByIdempotencyKey(idempotencyKey, cashierId);
  if (existing) return { success: true, transactionId: existing.id };

  const method = await getGlobalMethodById(methodId);
  if (!method) return { success: false, error: "Method not found." };

  const txType = method.type;
  const prefix = txType === "deposit" ? "DEP" : "PAY";
  const seq = await getNextTransactionSequence(txType, cashierId);
  const referenceCode = `${prefix}-${vrbCashier.slug.toUpperCase()}-${seq.toString().padStart(6, "0")}`;

  const [row] = await db
    .insert(transactions)
    .values({
      cashierId,
      type: txType,
      status: "unassigned",
      playerId,
      methodId,
      amount,
      currency,
      referenceCode,
      idempotencyKey,
    })
    .returning({ id: transactions.id });

  if (fieldValues.length > 0) {
    await db.insert(transactionFieldValues).values(
      fieldValues.map((fv) => ({
        cashierId,
        transactionId: row.id,
        methodFieldId: fv.methodFieldId,
        fieldLabelSnapshot: fv.fieldLabelSnapshot,
        fieldTypeSnapshot: fv.fieldTypeSnapshot,
        value: fv.value,
      }))
    );
  }

  return { success: true, transactionId: row.id };
}
