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

  if (sessionClaims?.public_metadata?.role !== "admin") {
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

  const clerkUser = await createRes.json();

  // The webhook will handle the DB insert via the user.created event.
  // The role is already embedded in public_metadata at creation time above,
  // so the webhook will read it and persist the correct role — no race condition.

  // Send a sign-in magic link so the new user can access the system without a password
  const magicLinkRes = await fetch(
    `https://api.clerk.com/v1/users/${clerkUser.id}/magic_links`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/sign-in`,
        expires_in_seconds: 172800, // 48 hours
      }),
    }
  );

  if (!magicLinkRes.ok) {
    // User was created; magic link email failed — not fatal, return success
    console.warn("[createUserAction] Magic link email could not be sent for new user:", await magicLinkRes.text());
  }

  return { success: true };
}
