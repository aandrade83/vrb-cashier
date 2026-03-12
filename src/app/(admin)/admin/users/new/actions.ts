"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
  const { sessionClaims, userId: adminClerkId } = await auth();

  if (sessionClaims?.public_metadata?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { email, firstName, lastName, role } = parsed.data;

  // Step 1: Create the user in Clerk
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
      skip_password_requirement: true,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json();
    console.error("[createUserAction] Clerk create error:", JSON.stringify(err));
    return { success: false, error: "Failed to create user. Please try again." };
  }

  const clerkUser = await createRes.json();

  // Step 2: Explicitly PATCH the role in Clerk metadata.
  // This is done as a separate call (not during creation) to guarantee it is applied.
  const metadataRes = await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: { role } }),
  });

  if (!metadataRes.ok) {
    console.error("[createUserAction] Clerk metadata PATCH error:", await metadataRes.text());
    // User was created but role not set — delete them to avoid orphan
    await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    return { success: false, error: "Failed to assign role. Please try again." };
  }

  // Step 3: Insert into DB with the correct role.
  // The webhook will also fire for this user but uses onConflictDoNothing,
  // so it becomes a safe no-op — this row always wins.
  const [adminRecord] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, adminClerkId!))
    .limit(1);

  await db.insert(users).values({
    clerkId: clerkUser.id,
    role,
    email,
    firstName,
    lastName,
    isActive: true,
    createdByAdminId: adminRecord?.id ?? null,
  }).onConflictDoNothing();

  // Step 4: Send magic link so the new user can log in without a password
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
    console.warn("[createUserAction] Magic link email failed for:", clerkUser.id, await magicLinkRes.text());
  }

  return { success: true };
}
