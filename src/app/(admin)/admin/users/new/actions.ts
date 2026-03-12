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

  // Step 1: Create the user in Clerk (no metadata yet — set it explicitly below)
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
    console.error("[createUserAction] Clerk create user error:", JSON.stringify(err));
    return { success: false, error: "Failed to create user. Please try again." };
  }

  const clerkUser = await createRes.json();
  console.log(`[createUserAction] Created Clerk user ${clerkUser.id}, assigning role="${role}"`);

  // Step 2: PATCH the role into Clerk public_metadata.
  // This must succeed before we insert into DB so the webhook GET also sees it.
  const metadataRes = await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: { role } }),
  });

  if (!metadataRes.ok) {
    const metaErr = await metadataRes.text();
    console.error("[createUserAction] Clerk metadata PATCH failed:", metaErr);
    // Clean up — delete the orphan user from Clerk
    await fetch(`https://api.clerk.com/v1/users/${clerkUser.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });
    return { success: false, error: "Failed to assign role. Please try again." };
  }

  const metaResult = await metadataRes.json();
  console.log(`[createUserAction] Metadata PATCH result for ${clerkUser.id}:`, JSON.stringify(metaResult.public_metadata));

  // Step 3: Insert into DB with the correct role.
  // The webhook will also fire but its GET to Clerk will see the role already set,
  // and onConflictDoNothing ensures this insert wins if webhook fires first.
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
        expires_in_seconds: 172800,
      }),
    }
  );

  if (!magicLinkRes.ok) {
    console.warn("[createUserAction] Magic link failed for:", clerkUser.id, await magicLinkRes.text());
  }

  return { success: true };
}
