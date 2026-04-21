"use server";

import { revalidatePath } from "next/cache";
import { isMasterAuthenticated } from "@/lib/master-auth";
import {
  createAddress,
  createAddressesBulk,
  toggleAddressActive,
  updateAddressPriority,
  deleteAddress,
} from "@/data/names-pool";

type Result = { success: true } | { success: false; error: string };

async function requireAuth() {
  const ok = await isMasterAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}

export async function createAddressAction(cashierId: string, value: string): Promise<Result> {
  await requireAuth();
  const v = value.trim();
  if (!v) return { success: false, error: "Value is required." };
  await createAddress(cashierId, v);
  revalidatePath("/master/addresses");
  return { success: true };
}

export async function createAddressesBulkAction(cashierId: string, raw: string): Promise<Result> {
  await requireAuth();
  const values = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (values.length === 0) return { success: false, error: "No valid values found." };
  await createAddressesBulk(cashierId, values);
  revalidatePath("/master/addresses");
  return { success: true };
}

export async function toggleAddressActiveAction(id: string): Promise<Result> {
  await requireAuth();
  await toggleAddressActive(id);
  revalidatePath("/master/addresses");
  return { success: true };
}

export async function updateAddressPriorityAction(id: string, priority: number): Promise<Result> {
  await requireAuth();
  if (!Number.isInteger(priority) || priority < 0) {
    return { success: false, error: "Priority must be a non-negative integer." };
  }
  await updateAddressPriority(id, priority);
  revalidatePath("/master/addresses");
  return { success: true };
}

export async function deleteAddressAction(id: string): Promise<Result> {
  await requireAuth();
  const result = await deleteAddress(id);
  if (!result.success) return { success: false, error: result.error! };
  revalidatePath("/master/addresses");
  return { success: true };
}
