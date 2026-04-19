/**
 * Migration 0006 — Enforce NOT NULL on username and password_hash
 *
 * ONLY safe to run after scripts/migrate-clear-clerk-users.ts has been executed.
 * Will FAIL if any user row still has NULL username or password_hash.
 *
 * Run: DATABASE_URL=... npx tsx scripts/run-migration-0006.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

async function exec(description: string, stmt: string) {
  try {
    await db.execute(sql.raw(stmt));
    console.log(`  ✓ ${description}`);
  } catch (e: unknown) {
    console.error(`  ✗ ${description}`);
    if (e && typeof e === "object") {
      const err = e as Record<string, unknown>;
      const cause = err.cause as Record<string, unknown> | undefined;
      console.error(`    ERROR: ${String(err.message ?? err).slice(0, 300)}`);
      if (cause?.message) console.error(`    CAUSE: ${String(cause.message).slice(0, 300)}`);
    }
    throw e;
  }
}

async function run() {
  console.log("=== Migration 0006: Enforce NOT NULL on username and password_hash ===\n");

  // Guard: verify users table is empty before enforcing NOT NULL
  const rows = await neonSql`SELECT COUNT(*)::int AS n FROM users WHERE username IS NULL OR password_hash IS NULL`;
  const nullRows = Number((rows[0] as { n: number }).n ?? 0);

  if (nullRows > 0) {
    console.error(`ERROR: ${nullRows} user row(s) still have NULL username or password_hash.`);
    console.error("Run scripts/migrate-clear-clerk-users.ts first.");
    process.exit(1);
  }

  console.log("  Guard check passed: no users with NULL username/password_hash.\n");

  await exec(
    "Set users.username NOT NULL",
    `ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`
  );

  await exec(
    "Set users.password_hash NOT NULL",
    `ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL`
  );

  await exec(
    "Create unique index: users_username_cashier_idx",
    `CREATE UNIQUE INDEX IF NOT EXISTS "users_username_cashier_idx" ON "users"("cashier_id", "username")`
  );

  console.log("\n=== Migration 0006 COMPLETE ===");
}

run().catch((err) => {
  console.error("\nMigration 0006 FAILED:", (err as Record<string, unknown>)?.cause ?? err?.message ?? err);
  process.exit(1);
});
