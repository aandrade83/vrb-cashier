"use server";

import { z } from "zod";
import { toggleCashierActive, deleteCashier, updateCashier } from "@/data/cashiers";
import { isMasterAuthenticated, verifyMasterPassword } from "@/lib/master-auth";
import { revalidatePath } from "next/cache";

async function requireMaster() {
  const ok = await isMasterAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}

// ---------------------------------------------------------------------------
// Toggle active status
// ---------------------------------------------------------------------------

export async function toggleCashierActiveAction(id: string): Promise<void> {
  await requireMaster();
  await toggleCashierActive(id);
  revalidatePath("/master/dashboard");
}

// ---------------------------------------------------------------------------
// Delete cashier (requires master password confirmation)
// ---------------------------------------------------------------------------

const deleteSchema = z.object({
  id: z.string().uuid(),
  password: z.string().min(1),
});

export async function deleteCashierAction(data: {
  id: string;
  password: string;
}): Promise<{ error?: string }> {
  await requireMaster();

  const parsed = deleteSchema.safeParse(data);
  if (!parsed.success) return { error: "Invalid input" };

  if (!(await verifyMasterPassword(parsed.data.password))) {
    return { error: "Incorrect master password" };
  }

  await deleteCashier(parsed.data.id);
  revalidatePath("/master/dashboard");
  return {};
}

// ---------------------------------------------------------------------------
// Edit cashier
// ---------------------------------------------------------------------------

const editSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  clientUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

export async function editCashierAction(data: {
  id: string;
  name: string;
  clientUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
}): Promise<{ error?: string }> {
  await requireMaster();

  const parsed = editSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  await updateCashier(parsed.data.id, {
    name: parsed.data.name,
    clientUrl: parsed.data.clientUrl || null,
    contactEmail: parsed.data.contactEmail || null,
    contactPhone: parsed.data.contactPhone || null,
  });

  revalidatePath("/master/dashboard");
  return {};
}
