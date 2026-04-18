/**
 * Migration 0007 — Rename users → cashier_users
 *
 * Safe, non-destructive. PostgreSQL automatically updates all FK constraints
 * that reference "users" when the table is renamed.
 *
 * Run: npx tsx scripts/run-migration-0007.ts
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
    const err = e as Record<string, unknown>;
    const cause = err.cause as Record<string, unknown> | undefined;
    console.error(`  ✗ ${description}`);
    console.error(`    ERROR: ${String(err.message ?? err).slice(0, 300)}`);
    if (cause?.message) console.error(`    CAUSE: ${String(cause.message).slice(0, 300)}`);
    throw e;
  }
}

async function run() {
  console.log("=== Migration 0007: Rename users → cashier_users ===\n");

  // Guard: confirm users table still exists (idempotency check)
  const rows = await neonSql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('users', 'cashier_users')
  `;
  const tableNames = rows.map((r: Record<string, unknown>) => r.table_name as string);

  if (tableNames.includes("cashier_users") && !tableNames.includes("users")) {
    console.log("  ✓ Already migrated: cashier_users exists, users does not. Nothing to do.");
    return;
  }

  if (!tableNames.includes("users")) {
    console.error("  ✗ Neither users nor cashier_users found. Something is wrong.");
    process.exit(1);
  }

  await exec(
    "Rename table: users → cashier_users",
    `ALTER TABLE "users" RENAME TO "cashier_users"`
  );

  await exec(
    "Rename index: users_cashier_id_idx → cashier_users_cashier_id_idx",
    `ALTER INDEX IF EXISTS "users_cashier_id_idx" RENAME TO "cashier_users_cashier_id_idx"`
  );

  await exec(
    "Rename index: users_role_idx → cashier_users_role_idx",
    `ALTER INDEX IF EXISTS "users_role_idx" RENAME TO "cashier_users_role_idx"`
  );

  await exec(
    "Rename index: users_username_cashier_idx → cashier_users_username_cashier_idx",
    `ALTER INDEX IF EXISTS "users_username_cashier_idx" RENAME TO "cashier_users_username_cashier_idx"`
  );

  console.log("\n=== Migration 0007 COMPLETE ===");
}

run().catch((err) => {
  console.error("\nMigration 0007 FAILED:", (err as Record<string, unknown>)?.cause ?? err?.message ?? err);
  process.exit(1);
});
