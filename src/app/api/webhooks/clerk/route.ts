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

    // If createUserAction already inserted this user (admin-created), skip entirely.
    // The role and metadata are already correct — the webhook must not overwrite them.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ success: true });
    }

    // Self-registered player: assign player role in Clerk metadata and insert into DB.
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

    await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ skip_password_requirement: true }),
    });

    await db.insert(users).values({
      clerkId,
      role: "player",
      email: email_addresses[0]?.email_address ?? "",
      firstName: first_name ?? null,
      lastName: last_name ?? null,
      avatarUrl: image_url ?? null,
    }).onConflictDoNothing();
  }

  return NextResponse.json({ success: true });
}
