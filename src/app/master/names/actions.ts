"use server";

import { revalidatePath } from "next/cache";
import { isMasterAuthenticated } from "@/lib/master-auth";
import {
  createName,
  createNamesBulk,
  toggleNameActive,
  updateNamePriority,
  deleteName,
} from "@/data/names-pool";

type Result = { success: true } | { success: false; error: string };

async function requireAuth() {
  const ok = await isMasterAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}

export async function createNameAction(cashierId: string, value: string): Promise<Result> {
  await requireAuth();
  const v = value.trim();
  if (!v) return { success: false, error: "Value is required." };
  await createName(cashierId, v);
  revalidatePath("/master/names");
  return { success: true };
}

export async function createNamesBulkAction(cashierId: string, raw: string): Promise<Result> {
  await requireAuth();
  const values = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (values.length === 0) return { success: false, error: "No valid values found." };
  await createNamesBulk(cashierId, values);
  revalidatePath("/master/names");
  return { success: true };
}

export async function toggleNameActiveAction(id: string): Promise<Result> {
  await requireAuth();
  await toggleNameActive(id);
  revalidatePath("/master/names");
  return { success: true };
}

export async function updateNamePriorityAction(id: string, priority: number): Promise<Result> {
  await requireAuth();
  if (!Number.isInteger(priority) || priority < 0) {
    return { success: false, error: "Priority must be a non-negative integer." };
  }
  await updateNamePriority(id, priority);
  revalidatePath("/master/names");
  return { success: true };
}

export async function deleteNameAction(id: string): Promise<Result> {
  await requireAuth();
  const result = await deleteName(id);
  if (!result.success) return { success: false, error: result.error! };
  revalidatePath("/master/names");
  return { success: true };
}
