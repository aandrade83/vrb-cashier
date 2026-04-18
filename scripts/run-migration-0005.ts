/**
 * Migration 0005 — Remove Clerk, add internal auth columns
 *
 * Applies the following changes:
 *   1. Drops clerk_id index and column from users
 *   2. Makes users.email nullable
 *   3. Adds username and password_hash columns (nullable first — safe with existing rows)
 *   4. Creates user_sessions table
 *   5. Creates login_attempts table
 *   6. Adds acting_cashier_id to master_sessions
 *
 * No data is deleted. All existing rows are preserved.
 *
 * Run: DATABASE_URL=... npx tsx scripts/run-migration-0005.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

async function exec(description: string, stmt: string) {
  try {
    await db.execute(sql.raw(stmt));
    console.log(`  ✓ ${description}`);
  } catch (e: unknown) {
    console.error(`  ✗ ${description}`);
    if (e && typeof e === "object") {
      const err = e as Record<string, unknown>;
      const msg = err.message ?? err.cause ?? String(e);
      const cause = err.cause as Record<string, unknown> | undefined;
      console.error(`    ERROR: ${String(msg).slice(0, 300)}`);
      if (cause?.message) console.error(`    CAUSE: ${String(cause.message).slice(0, 300)}`);
      if (cause?.code) console.error(`    CODE: ${cause.code}`);
    }
    throw e;
  }
}

async function run() {
  console.log("=== Migration 0005: Remove Clerk, add internal auth ===\n");

  // 1. Drop Clerk index and column
  await exec(
    "Drop users_clerk_id_idx index",
    `DROP INDEX IF EXISTS "users_clerk_id_idx"`
  );
  await exec(
    "Drop clerk_id column from users",
    `ALTER TABLE "users" DROP COLUMN IF EXISTS "clerk_id"`
  );

  // 2. Make email nullable
  await exec(
    "Make users.email nullable",
    `ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`
  );

  // 3. Add new auth columns (nullable first — safe with existing rows)
  await exec(
    "Add users.username (nullable)",
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text`
  );
  await exec(
    "Add users.password_hash (nullable)",
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text`
  );

  // 4. Create user_sessions table
  await exec(
    "Create user_sessions table",
    `CREATE TABLE IF NOT EXISTS "user_sessions" (
      "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "token"      text NOT NULL,
      "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id") ON DELETE CASCADE,
      "role"       "user_role" NOT NULL,
      "created_at" timestamp with time zone NOT NULL DEFAULT now(),
      "expires_at" timestamp with time zone NOT NULL,
      CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
    )`
  );
  await exec(
    "Index: user_sessions_token_idx",
    `CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_token_idx" ON "user_sessions"("token")`
  );
  await exec(
    "Index: user_sessions_user_id_idx",
    `CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id")`
  );
  await exec(
    "Index: user_sessions_cashier_id_idx",
    `CREATE INDEX IF NOT EXISTS "user_sessions_cashier_id_idx" ON "user_sessions"("cashier_id")`
  );
  await exec(
    "Index: user_sessions_expires_at_idx",
    `CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions"("expires_at")`
  );

  // 5. Create login_attempts table
  await exec(
    "Create login_attempts table",
    `CREATE TABLE IF NOT EXISTS "login_attempts" (
      "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "cashier_id"          uuid REFERENCES "cashiers"("id") ON DELETE CASCADE,
      "username"            text NOT NULL,
      "ip_address"          text,
      "success"             boolean NOT NULL,
      "failure_reason"      text,
      "sportsbook_checked"  boolean NOT NULL DEFAULT false,
      "created_at"          timestamp with time zone NOT NULL DEFAULT now()
    )`
  );
  await exec(
    "Index: login_attempts_lookup_idx",
    `CREATE INDEX IF NOT EXISTS "login_attempts_lookup_idx" ON "login_attempts"("cashier_id", "username", "created_at" DESC)`
  );

  // 6. Add acting_cashier_id to master_sessions
  await exec(
    "Add master_sessions.acting_cashier_id (nullable)",
    `ALTER TABLE "master_sessions" ADD COLUMN IF NOT EXISTS "acting_cashier_id" uuid REFERENCES "cashiers"("id") ON DELETE SET NULL`
  );

  console.log("\n=== Migration 0005 COMPLETE ===");
}

run().catch((err) => {
  console.error("\nMigration 0005 FAILED:", err.message ?? err);
  process.exit(1);
});
