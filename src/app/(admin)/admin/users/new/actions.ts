"use server";

import { z } from "zod";
import { getCashierId } from "@/lib/cashier-context";
import { getUserSession } from "@/lib/auth/session";
import { createUser, getUserByUsername } from "@/data/users";
import { hashPassword } from "@/lib/auth/password";

const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9._-]+$/, {
    message: "Username may only contain lowercase letters, numbers, dots, underscores, and hyphens.",
  }),
  password: z.string().min(8),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  role: z.enum(["admin", "clerk"]),
});

type CreateUserInput = z.infer<typeof createUserSchema>;
type ActionResult = { success: true } | { success: false; error: string };

export async function createUserAction(data: CreateUserInput): Promise<ActionResult> {
  const session = await getUserSession();
  if (!session || session.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const cashierId = await getCashierId();

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
    createdByAdminId: session.userId,
  });

  return { success: true };
}
