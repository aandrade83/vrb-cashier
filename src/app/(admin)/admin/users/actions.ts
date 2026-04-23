"use server";

import { z } from "zod";
import { db } from "@/db";
import { cashierUsers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { setUserActive, deleteUser, resetEmailVerification } from "@/data/users";
import { getCashierId } from "@/lib/cashier-context";
import { getSessionForCashier } from "@/lib/auth/session";

type ActionResult = { success: true } | { success: false; error: string };

const userIdSchema = z.object({ userId: z.string().uuid() });

export async function disableUserAction(data: { userId: string }): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") return { success: false, error: "Unauthorized" };

  const parsed = userIdSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await setUserActive(parsed.data.userId, false, cashierId);
  return { success: true };
}

export async function enableUserAction(data: { userId: string }): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") return { success: false, error: "Unauthorized" };

  const parsed = userIdSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  await setUserActive(parsed.data.userId, true, cashierId);
  return { success: true };
}

export async function deleteUserAction(data: { userId: string }): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") return { success: false, error: "Unauthorized" };

  const parsed = userIdSchema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { userId } = parsed.data;

  if (access.userId === userId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  const [user] = await db
    .select({ role: cashierUsers.role })
    .from(cashierUsers)
    .where(and(eq(cashierUsers.id, userId), eq(cashierUsers.cashierId, cashierId)))
    .limit(1);

  if (!user) return { success: false, error: "User not found." };
  if (user.role === "player") {
    return { success: false, error: "Player accounts cannot be deleted from here." };
  }

  await deleteUser(userId, cashierId);
  return { success: true };
}

export async function resetEmailVerificationAction(data: { userId: string }): Promise<ActionResult> {
  try {
    const cashierId = await getCashierId();
    const access = await getSessionForCashier(cashierId);
    if (!access || access.role !== "admin") {
      console.warn("[reset-email] unauthorized — role:", access?.role);
      return { success: false, error: "Unauthorized" };
    }

    const parsed = userIdSchema.safeParse(data);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

    const [user] = await db
      .select({ role: cashierUsers.role })
      .from(cashierUsers)
      .where(and(eq(cashierUsers.id, parsed.data.userId), eq(cashierUsers.cashierId, cashierId)))
      .limit(1);

    if (!user) {
      console.warn("[reset-email] user not found — userId:", parsed.data.userId, "cashierId:", cashierId);
      return { success: false, error: "User not found." };
    }
    if (user.role !== "player") {
      return { success: false, error: "Only player accounts can be reset." };
    }

    await resetEmailVerification(parsed.data.userId, cashierId);
    console.info("[reset-email] reset OK for userId:", parsed.data.userId);
    return { success: true };
  } catch (err) {
    console.error("[reset-email] unexpected error:", err);
    return { success: false, error: "Server error. Check logs." };
  }
}
