"use server";

import { z } from "zod";
import { getCashierId } from "@/lib/cashier-context";
import { getSessionForCashier } from "@/lib/auth/session";
import { createUser, getUserByUsername } from "@/data/users";
import { hashPassword } from "@/lib/auth/password";

const createUserSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "clerk"]),
});

type CreateUserInput = z.infer<typeof createUserSchema>;
type ActionResult = { success: true } | { success: false; error: string };

export async function createUserAction(data: CreateUserInput): Promise<ActionResult> {
  const cashierId = await getCashierId();
  const access = await getSessionForCashier(cashierId);
  if (!access || access.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { username, password, firstName, lastName, email, role } = parsed.data;
  const normalizedUsername = username.toLowerCase();

  const existing = await getUserByUsername(normalizedUsername, cashierId);
  if (existing) {
    return { success: false, error: "A user with this username already exists." };
  }

  const passwordHash = await hashPassword(password);

  await createUser({
    cashierId,
    username: normalizedUsername,
    passwordHash,
    role,
    email: email || undefined,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    createdByAdminId: access.userId ?? undefined,
  });

  return { success: true };
}
