"use server";

import { revalidatePath } from "next/cache";
import { getMasterSessionData, getMasterSessionFromCookies } from "@/lib/master-auth";
import { setMasterUserActive, deleteMasterUser } from "@/data/master-users";

type ActionResult = { success: true } | { success: false; error: string };

async function requireMasterAdmin() {
  const token = await getMasterSessionFromCookies();
  if (!token) return null;
  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_admin") return null;
  return session;
}

export async function setMasterUserActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await requireMasterAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!session.isEnvRoot && session.masterUserId === id) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  await setMasterUserActive(id, isActive);
  revalidatePath("/master/users");
  return { success: true };
}

export async function deleteMasterUserAction(id: string): Promise<ActionResult> {
  const session = await requireMasterAdmin();
  if (!session) return { success: false, error: "Unauthorized" };

  if (!session.isEnvRoot && session.masterUserId === id) {
    return { success: false, error: "You cannot delete your own account." };
  }

  await deleteMasterUser(id);
  revalidatePath("/master/users");
  return { success: true };
}
