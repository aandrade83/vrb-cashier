"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMasterSessionFromCookies, getMasterSessionData } from "@/lib/master-auth";
import {
  createNameList,
  addNamesToList,
  updateNameInList,
  deleteNameFromList,
  removeCashierFromList,
  deleteNameList,
} from "@/data/name-lists";

type Result = { success: true } | { success: false; error: string };
const REVALIDATE = "/master/name-lists";

async function requireAdminAuth() {
  const token = await getMasterSessionFromCookies();
  if (!token) throw new Error("Unauthorized");
  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_admin") throw new Error("Unauthorized");
}

// ---------------------------------------------------------------------------
// Create list
// ---------------------------------------------------------------------------

const createListSchema = z.object({
  methodId: z.string().uuid(),
  cashierIds: z.array(z.string().uuid()).min(1),
  blockingMode: z.enum(["yes", "no"]),
});

export async function createNameListAction(
  methodId: string,
  cashierIds: string[],
  blockingMode: "yes" | "no",
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  await requireAdminAuth();
  const parsed = createListSchema.safeParse({ methodId, cashierIds, blockingMode });
  if (!parsed.success) return { success: false, error: "Invalid input." };
  const result = await createNameList(parsed.data.methodId, parsed.data.cashierIds, parsed.data.blockingMode);
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return result;
}

// ---------------------------------------------------------------------------
// Add single name
// ---------------------------------------------------------------------------

const addSingleSchema = z.object({
  nameListId: z.string().uuid(),
  value: z.string().min(1),
  priority: z.number().int().min(1),
});

export async function addSingleNameToListAction(
  nameListId: string,
  value: string,
  priority: number,
): Promise<{ success: true; added: number; skipped: number } | { success: false; error: string }> {
  await requireAdminAuth();
  const parsed = addSingleSchema.safeParse({ nameListId, value: value.trim(), priority });
  if (!parsed.success) return { success: false, error: "Invalid input." };
  const result = await addNamesToList(parsed.data.nameListId, [{ value: parsed.data.value, priority: parsed.data.priority }]);
  revalidatePath(REVALIDATE);
  return { success: true, ...result };
}

// ---------------------------------------------------------------------------
// Add bulk names
// ---------------------------------------------------------------------------

export async function addBulkNamesToListAction(
  nameListId: string,
  raw: string,
): Promise<{ success: true; added: number; skipped: number } | { success: false; error: string }> {
  await requireAdminAuth();
  if (!z.string().uuid().safeParse(nameListId).success) return { success: false, error: "Invalid list id." };
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { success: false, error: "No valid names found." };
  const entries = lines.map((v, i) => ({ value: v, priority: i + 1 }));
  const result = await addNamesToList(nameListId, entries);
  revalidatePath(REVALIDATE);
  return { success: true, ...result };
}

// ---------------------------------------------------------------------------
// Update name
// ---------------------------------------------------------------------------

const updateNameSchema = z.object({
  id: z.string().uuid(),
  value: z.string().min(1).optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function updateNameInListAction(
  id: string,
  data: { value?: string; priority?: number; isActive?: boolean },
): Promise<Result> {
  await requireAdminAuth();
  const parsed = updateNameSchema.safeParse({ id, ...data });
  if (!parsed.success) return { success: false, error: "Invalid input." };
  const { id: nameId, ...updates } = parsed.data;
  const result = await updateNameInList(nameId, updates);
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Toggle active
// ---------------------------------------------------------------------------

export async function toggleNameActiveAction(id: string, isActive: boolean): Promise<Result> {
  await requireAdminAuth();
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid id." };
  const result = await updateNameInList(id, { isActive });
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete name
// ---------------------------------------------------------------------------

export async function deleteNameFromListAction(id: string): Promise<Result> {
  await requireAdminAuth();
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid id." };
  const result = await deleteNameFromList(id);
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Remove cashier
// ---------------------------------------------------------------------------

export async function removeCashierFromListAction(
  nameListId: string,
  cashierId: string,
): Promise<Result> {
  await requireAdminAuth();
  const parsed = z.object({ nameListId: z.string().uuid(), cashierId: z.string().uuid() }).safeParse({ nameListId, cashierId });
  if (!parsed.success) return { success: false, error: "Invalid input." };
  const result = await removeCashierFromList(parsed.data.nameListId, parsed.data.cashierId);
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Delete list
// ---------------------------------------------------------------------------

export async function deleteNameListAction(id: string): Promise<Result> {
  await requireAdminAuth();
  if (!z.string().uuid().safeParse(id).success) return { success: false, error: "Invalid id." };
  const result = await deleteNameList(id);
  if (!result.success) return result;
  revalidatePath(REVALIDATE);
  return { success: true };
}
