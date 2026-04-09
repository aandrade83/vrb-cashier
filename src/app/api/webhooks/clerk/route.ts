import { Webhook } from "svix";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, cashiers } from "@/db/schema";
import { eq } from "drizzle-orm";

// Seed cashier ID — all users created via self-registration go to VRB by default.
// In a true multi-tenant setup, the webhook payload would carry a cashier hint
// (e.g. via publicMetadata.cashierId set during sign-up redirection).
const DEFAULT_CASHIER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

type ClerkUserCreatedData = {
  id: string;
  email_addresses: { email_address: string }[];
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  username: string | null;
  public_metadata?: { role?: string; cashierId?: string };
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
    const { id: clerkId, email_addresses, image_url, username } = evt.data;

    // Fetch the user's current metadata directly from Clerk
    const clerkUserRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
    });

    let role: "admin" | "clerk" | "player" = "player";
    let cashierId = DEFAULT_CASHIER_ID;

    if (clerkUserRes.ok) {
      const clerkUser = await clerkUserRes.json() as { public_metadata?: { role?: string; cashierId?: string } };
      const metaRole = clerkUser.public_metadata?.role;
      const metaCashierId = clerkUser.public_metadata?.cashierId;

      if (metaRole === "admin" || metaRole === "clerk") {
        role = metaRole;
      }

      // If a specific cashier was set in metadata, use it
      if (metaCashierId) {
        // Verify the cashier exists
        const [cashier] = await db
          .select({ id: cashiers.id })
          .from(cashiers)
          .where(eq(cashiers.id, metaCashierId))
          .limit(1);

        if (cashier) {
          cashierId = cashier.id;
        }
      }
    } else {
      console.error("[webhook/clerk] Failed to fetch user from Clerk:", clerkId);
    }

    if (role === "player") {
      // Self-registered player: set the role in Clerk metadata
      await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_metadata: { role: "player" } }),
      });
    }

    // Sync to DB — onConflictDoNothing so createUserAction's insert always wins
    await db.insert(users).values({
      clerkId,
      cashierId,
      role,
      email: email_addresses[0]?.email_address ?? "",
      firstName: username ?? null,
      lastName: null,
      avatarUrl: image_url ?? null,
    }).onConflictDoNothing();
  }

  return NextResponse.json({ success: true });
}
