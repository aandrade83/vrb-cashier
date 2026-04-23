"use server";

import { z } from "zod";
import { toggleCashierActive, deleteCashier, updateCashier } from "@/data/cashiers";
import { cloneCashierMethods } from "@/data/methods";
import {
  isMasterAuthenticated,
  verifyMasterPassword,
  getMasterSessionFromCookies,
  getMasterSessionData,
} from "@/lib/master-auth";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  cashiers,
  cashierUsers,
  transactions,
  notifications,
  auditLogs,
  loginAttempts,
  names,
  addresses,
} from "@/db/schema";
import { eq } from "drizzle-orm";

async function requireMaster() {
  const ok = await isMasterAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}

async function requireEnvRoot(): Promise<boolean> {
  const token = await getMasterSessionFromCookies();
  if (!token) return false;
  const session = await getMasterSessionData(token);
  return !!(session?.isEnvRoot);
}

// ---------------------------------------------------------------------------
// Toggle active status
// ---------------------------------------------------------------------------

export async function toggleCashierActiveAction(id: string): Promise<void> {
  await requireMaster();
  await toggleCashierActive(id);
  revalidatePath("/master/dashboard");
}

export async function toggleDepositsEnabledAction(id: string): Promise<void> {
  await requireMaster();
  const [c] = await db.select({ depositsEnabled: cashiers.depositsEnabled }).from(cashiers).where(eq(cashiers.id, id)).limit(1);
  if (c) await db.update(cashiers).set({ depositsEnabled: !c.depositsEnabled }).where(eq(cashiers.id, id));
  revalidatePath("/master/dashboard");
}

export async function togglePayoutsEnabledAction(id: string): Promise<void> {
  await requireMaster();
  const [c] = await db.select({ payoutsEnabled: cashiers.payoutsEnabled }).from(cashiers).where(eq(cashiers.id, id)).limit(1);
  if (c) await db.update(cashiers).set({ payoutsEnabled: !c.payoutsEnabled }).where(eq(cashiers.id, id));
  revalidatePath("/master/dashboard");
}

export async function cloneCashierMethodsAction(
  sourceCashierId: string,
  targetCashierId: string,
): Promise<{ error?: string }> {
  await requireMaster();
  await cloneCashierMethods(sourceCashierId, targetCashierId);
  revalidatePath("/master/dashboard");
  return {};
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

// ---------------------------------------------------------------------------
// Reset cashier data (ENV root only)
// Deletes all users + transactions for the cashier, keeping the cashier itself.
// ---------------------------------------------------------------------------

export async function resetCashierDataAction(data: {
  id: string;
  password: string;
}): Promise<{ error?: string }> {
  const isEnvRoot = await requireEnvRoot();
  if (!isEnvRoot) return { error: "Unauthorized — only the ENV root account can reset cashier data." };

  const parsed = z
    .object({ id: z.string().uuid(), password: z.string().min(1) })
    .safeParse(data);
  if (!parsed.success) return { error: "Invalid input" };

  if (!(await verifyMasterPassword(parsed.data.password))) {
    return { error: "Incorrect master password" };
  }

  const cashierId = parsed.data.id;

  // FK-safe deletion order. transactionFieldValues, transactionAttachments,
  // transactionUpdates all cascade from transactions. userSessions cascade from cashierUsers.
  await db.delete(notifications).where(eq(notifications.cashierId, cashierId));
  await db.delete(auditLogs).where(eq(auditLogs.cashierId, cashierId));
  await db.delete(transactions).where(eq(transactions.cashierId, cashierId));
  // Unlock pool entries (lockedByTransactionId is null after cascade, but isLocked stays true)
  await db.update(names).set({ isLocked: false, lockedAt: null }).where(eq(names.cashierId, cashierId));
  await db.update(addresses).set({ isLocked: false, lockedAt: null }).where(eq(addresses.cashierId, cashierId));
  await db.delete(loginAttempts).where(eq(loginAttempts.cashierId, cashierId));
  await db.delete(cashierUsers).where(eq(cashierUsers.cashierId, cashierId));

  revalidatePath("/master/dashboard");
  return {};
}
