"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMasterSessionData, getMasterSessionFromCookies, hashMasterPassword } from "@/lib/master-auth";
import { createMasterUser, getMasterUserByEmail } from "@/data/master-users";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["master_admin", "master_clerk"]),
  mustResetPassword: z.boolean().optional(),
});

type ActionResult = { success: true } | { success: false; error: string };

export async function createMasterUserAction(data: unknown): Promise<ActionResult> {
  const token = await getMasterSessionFromCookies();
  if (!token) return { success: false, error: "Unauthorized" };
  const session = await getMasterSessionData(token);
  if (!session || session.role !== "master_admin") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { email, password, role, mustResetPassword } = parsed.data;

  const emailExists = await getMasterUserByEmail(email);
  if (emailExists) return { success: false, error: "Email already in use." };

  const passwordHash = await hashMasterPassword(password);
  // username = email (used as the unique identifier for display)
  await createMasterUser({
    email,
    username: email,
    passwordHash,
    role,
    mustResetPassword,
  });

  revalidatePath("/master/users");
  return { success: true };
}
