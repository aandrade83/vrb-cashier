"use server";

import { revalidatePath } from "next/cache";
import { getMasterSessionData, getMasterSessionFromCookies, getMasterUserById } from "@/lib/master-auth";
import { toggleUserCashierPermission } from "@/data/master-users";

type ActionResult = { success: true } | { success: false; error: string };

export async function togglePermissionAction(
  masterUserId: string,
  cashierId: string,
  assign: boolean,
): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };
  const session = await getMasterSessionData(token);
  if (!session) return { success: false, error: "Unauthorized" };

  if (!session.isEnvRoot) {
    if (session.role !== "master_admin") return { success: false, error: "Unauthorized" };
    // master_admin can only manage permissions for master_clerk users
    const targetUser = await getMasterUserById(masterUserId);
    if (!targetUser || targetUser.role !== "master_clerk") {
      return { success: false, error: "You can only manage permissions for master_clerk users." };
    }
  }

  await toggleUserCashierPermission(masterUserId, cashierId, assign);
  revalidatePath(`/master/users/${masterUserId}/permissions`);
  return { success: true };
}
