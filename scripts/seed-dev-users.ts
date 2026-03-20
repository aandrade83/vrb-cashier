import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "../src/db/schema";

const db = drizzle(process.env.DATABASE_URL!);

const TEST_USERS = [
  { email: "player+clerk_test@gmail.com", username: "dev_player", role: "player" as const },
  { email: "admin+clerk_test@gmail.com",  username: "dev_admin",  role: "admin"  as const },
  { email: "clerk+clerk_test@gmail.com",  username: "dev_clerk",  role: "clerk"  as const },
];

async function createClerkUser(email: string, username: string, role: string) {
  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      username,
      public_metadata: { role },
    }),
  });

  const body = await res.json();

  if (!res.ok) {
    const codes = body.errors?.map((e: any) => e.code) ?? [];
    // If email or username already taken, find the existing user
    if (codes.includes("form_identifier_exists") || codes.includes("form_username_taken")) {
      console.log(`  User ${email} already exists in Clerk, fetching...`);
      return await getExistingClerkUser(email);
    }
    throw new Error(`Clerk create failed for ${email}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function getExistingClerkUser(email: string) {
  const res = await fetch(
    `https://api.clerk.com/v1/users?limit=500`,
    { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } }
  );
  if (!res.ok) throw new Error(`Failed to list Clerk users`);
  const data = await res.json();
  const match = data.find((u: any) =>
    u.email_addresses?.some((e: any) => e.email_address === email)
  );
  if (!match) throw new Error(`Could not find existing Clerk user: ${email}`);
  return match;
}

async function run() {
  for (const { email, username, role } of TEST_USERS) {
    console.log(`\nProcessing ${email} (${role})...`);

    const clerkUser = await createClerkUser(email, username, role);
    const clerkId: string = clerkUser.id;

    // Ensure correct role metadata
    await fetch(`https://api.clerk.com/v1/users/${clerkId}/metadata`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_metadata: { role } }),
    });

    // Insert into Neon DB (idempotent)
    await db.insert(users).values({
      clerkId,
      role,
      email,
      firstName: username,
      lastName: null,
      avatarUrl: null,
      isActive: true,
    }).onConflictDoNothing();

    console.log(`  ✓ ${email} → clerkId: ${clerkId}, role: ${role}`);
  }

  console.log("\nDone. All test users seeded.");
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
