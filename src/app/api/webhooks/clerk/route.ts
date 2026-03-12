import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserCreatedData = {
  id: string;
  email_addresses: { email_address: string }[];
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
};

export async function POST(request: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook/clerk] CLERK_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const body = await request.text();
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  let evt: { type: string; data: ClerkUserCreatedData };
  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: ClerkUserCreatedData };
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (evt.type === "user.created") {
    const { id: clerkId, email_addresses, first_name, last_name, image_url } = evt.data;

    // Check if this user was already inserted by createUserAction (admin-created users).
    // createUserAction inserts into the DB synchronously before returning, so if the row
    // exists here the role is already correct — skip all Clerk metadata writes entirely.
    const existing = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing.length > 0) {
      // Admin-created user — DB row and Clerk metadata already set correctly.
      return NextResponse.json({ success: true });
    }

    // Self-registered player — set role and skip password requirement in Clerk.
    const metadataRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_metadata: { role: "player" } }),
    });

    if (!metadataRes.ok) {
      console.error("[webhook/clerk] Failed to assign player role to user:", clerkId);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }

    const userUpdateRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skip_password_requirement: true }),
    });

    if (!userUpdateRes.ok) {
      console.error("[webhook/clerk] Failed to update password requirement for user:", clerkId);
    }

    await db.insert(users).values({
      clerkId,
      role: "player",
      email: email_addresses[0]?.email_address ?? "",
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      avatarUrl: image_url ?? null,
    });
  }

  return NextResponse.json({ success: true });
}
