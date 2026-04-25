"use server";

import { z } from "zod";
import { getUserSession, getMasterSession } from "@/lib/auth/session";
import { getCashierPageAccess } from "@/lib/auth/cashier-access";
import { peekNextName } from "@/data/name-lists";

export async function requestNameAction(methodId: string): Promise<
  | { success: true; nameId: string; value: string; blockingMode: "yes" | "no" }
  | { success: false; error: string }
> {
  if (!z.string().uuid().safeParse(methodId).success) {
    return { success: false, error: "Invalid method." };
  }

  const [userSession, masterSession] = await Promise.all([
    getUserSession(),
    getMasterSession(),
  ]);

  const isMasterActing = !!(masterSession?.actingCashierId);
  let cashierId: string;

  if (isMasterActing) {
    const access = await getCashierPageAccess("player");
    if (!access) return { success: false, error: "Unauthorized" };
    cashierId = access.cashierId;
  } else if (userSession?.role === "player") {
    cashierId = userSession.cashierId;
  } else {
    return { success: false, error: "Unauthorized" };
  }

  const result = await peekNextName(methodId, cashierId);
  if (!result) {
    return { success: false, error: "No names available at this time." };
  }

  return { success: true, nameId: result.id, value: result.value, blockingMode: result.blockingMode };
}
