"use server";

import { revalidatePath } from "next/cache";
import { setCashierMethodAssignments } from "@/data/methods";
import { isMasterAuthenticated } from "@/lib/master-auth";

type ActionResult = { success: true } | { success: false; error: string };

export async function setCashierMethodAssignmentsAction(
  cashierId: string,
  assignments: { methodId: string; enabled: boolean }[],
): Promise<ActionResult> {
  const ok = await isMasterAuthenticated();
  if (!ok) return { success: false, error: "Unauthorized" };

  await setCashierMethodAssignments(cashierId, assignments);
  revalidatePath(`/master/cashiers/${cashierId}/methods`);
  return { success: true };
}
