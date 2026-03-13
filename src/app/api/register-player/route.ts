import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch user from Clerk
  const clerkUserRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
  });

  if (!clerkUserRes.ok) {
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }

  const clerkUser = await clerkUserRes.json();

  // Only assign player role if no role is set (self-registered)
  const existingRole = clerkUser.public_metadata?.role;
  if (existingRole && existingRole !== "player") {
    return NextResponse.json({ role: existingRole });
  }

  // Set role in Clerk metadata
  await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ public_metadata: { role: "player" } }),
  });

  // Insert into DB
  await db.insert(users).values({
    clerkId: userId,
    role: "player",
    email: clerkUser.email_addresses?.[0]?.email_address ?? "",
    firstName: clerkUser.username ?? null,
    lastName: null,
    avatarUrl: clerkUser.image_url ?? null,
  }).onConflictDoNothing();

  return NextResponse.json({ role: "player" });
}
