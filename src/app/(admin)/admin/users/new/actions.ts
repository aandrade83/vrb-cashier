"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["admin", "clerk"]),
});

type CreateUserInput = z.infer<typeof createUserSchema>;

type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function createUserAction(data: CreateUserInput): Promise<ActionResult> {
  const { sessionClaims } = await auth();

  if (sessionClaims?.metadata?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, firstName, lastName, role } = parsed.data;

  const createRes = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      first_name: firstName,
      last_name: lastName,
      public_metadata: { role },
      skip_password_requirement: true,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error("[createUserAction] Clerk API error:", JSON.stringify(err));
    return { success: false, error: "Failed to create user. Please try again." };
  }

  const inviteRes = await fetch("https://api.clerk.com/v1/invitations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sign-in`,
    }),
  });

  if (!inviteRes.ok) {
    // User was created; invite email failed — not fatal, return success
    console.warn("[createUserAction] Invite email could not be sent for new user.");
  }

  return { success: true };
}
