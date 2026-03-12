"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { setUserActive, deleteUserByClerkId } from "@/data/users";

type ActionResult = { success: true } | { success: false; error: string };

const clerkIdSchema = z.object({ clerkId: z.string().min(1) });

async function requireAdmin(): Promise<ActionResult | null> {
  const { sessionClaims } = await auth();
  if (sessionClaims?.public_metadata?.role !== "admin") {
    return { success: false, error: "Unauthorized" };
  }
  return null;
}

export async function disableUserAction(data: {
  clerkId: string;
}): Promise<ActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const parsed = clerkIdSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { clerkId } = parsed.data;

  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ banned: true }),
  });

  if (!res.ok) {
    console.error("[disableUserAction] Clerk API error:", await res.text());
    return { success: false, error: "Failed to disable user. Please try again." };
  }

  await setUserActive(clerkId, false);
  return { success: true };
}

export async function enableUserAction(data: {
  clerkId: string;
}): Promise<ActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const parsed = clerkIdSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { clerkId } = parsed.data;

  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ banned: false }),
  });

  if (!res.ok) {
    console.error("[enableUserAction] Clerk API error:", await res.text());
    return { success: false, error: "Failed to enable user. Please try again." };
  }

  await setUserActive(clerkId, true);
  return { success: true };
}

export async function deleteUserAction(data: {
  clerkId: string;
}): Promise<ActionResult> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const parsed = clerkIdSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { clerkId } = parsed.data;

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) {
    return { success: false, error: "User not found." };
  }

  if (user.role === "player") {
    return { success: false, error: "Player accounts cannot be deleted from here." };
  }

  const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
  });

  if (!res.ok) {
    console.error("[deleteUserAction] Clerk API error:", await res.text());
    return { success: false, error: "Failed to delete user. Please try again." };
  }

  await deleteUserByClerkId(clerkId);
  return { success: true };
}
