/**
 * Migration 0008 — Rename random_names → names, random_addresses → addresses
 *                  Update field_type enum: random_name → name, random_address → address
 *
 * Safe, non-destructive. PostgreSQL renames the tables and updates FK refs automatically.
 *
 * Run: npx tsx scripts/run-migration-0008.ts
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
  console.log("=== Migration 0008: Rename random_names/addresses, update field_type enum ===\n");

  // Idempotency check
  const tables = await neonSql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('random_names','random_addresses','names','addresses')
  `;
  const tableNames = tables.map((r: Record<string, unknown>) => r.table_name as string);

  const needsNamesRename = tableNames.includes("random_names") && !tableNames.includes("names");
  const needsAddressesRename = tableNames.includes("random_addresses") && !tableNames.includes("addresses");

  if (!needsNamesRename && !needsAddressesRename) {
    console.log("  ✓ Already migrated: names and addresses tables exist. Nothing to do.");
  }

  // ── Table renames ────────────────────────────────────────────────────────────

  if (needsNamesRename) {
    await exec(
      "Rename table: random_names → names",
      `ALTER TABLE "random_names" RENAME TO "names"`
    );
    await exec(
      "Rename index: random_names_cashier_id_idx → names_cashier_id_idx",
      `ALTER INDEX IF EXISTS "random_names_cashier_id_idx" RENAME TO "names_cashier_id_idx"`
    );
    await exec(
      "Rename index: random_names_priority_idx → names_priority_idx",
      `ALTER INDEX IF EXISTS "random_names_priority_idx" RENAME TO "names_priority_idx"`
    );
    await exec(
      "Rename index: random_names_locked_idx → names_locked_idx",
      `ALTER INDEX IF EXISTS "random_names_locked_idx" RENAME TO "names_locked_idx"`
    );
  }

  if (needsAddressesRename) {
    await exec(
      "Rename table: random_addresses → addresses",
      `ALTER TABLE "random_addresses" RENAME TO "addresses"`
    );
    await exec(
      "Rename index: random_addresses_cashier_id_idx → addresses_cashier_id_idx",
      `ALTER INDEX IF EXISTS "random_addresses_cashier_id_idx" RENAME TO "addresses_cashier_id_idx"`
    );
    await exec(
      "Rename index: random_addresses_priority_idx → addresses_priority_idx",
      `ALTER INDEX IF EXISTS "random_addresses_priority_idx" RENAME TO "addresses_priority_idx"`
    );
    await exec(
      "Rename index: random_addresses_locked_idx → addresses_locked_idx",
      `ALTER INDEX IF EXISTS "random_addresses_locked_idx" RENAME TO "addresses_locked_idx"`
    );
  }

  // ── field_type enum: add new values, migrate data, drop old values ────────────
  // PostgreSQL enums cannot remove values directly. Strategy:
  //   1. Add new enum values 'name' and 'address'
  //   2. Update existing data in method_fields
  //   3. ALTER the default (if any) — none here
  // Note: removing old enum values from a pg enum requires a full type recreation,
  // which is complex. Instead we just add the new values and update all data.
  // The old values remain in the enum type but will never be used.

  await exec(
    "Add enum value 'name' to field_type",
    `ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'name'`
  );

  await exec(
    "Add enum value 'address' to field_type",
    `ALTER TYPE "field_type" ADD VALUE IF NOT EXISTS 'address'`
  );

  // Update existing rows
  const nameResult = await neonSql`
    UPDATE "method_fields" SET "field_type" = 'name' WHERE "field_type" = 'random_name'
  `;
  console.log(`  ✓ Updated method_fields: random_name → name (${(nameResult as unknown as { rowCount: number }).rowCount ?? 0} rows)`);

  const addrResult = await neonSql`
    UPDATE "method_fields" SET "field_type" = 'address' WHERE "field_type" = 'random_address'
  `;
  console.log(`  ✓ Updated method_fields: random_address → address (${(addrResult as unknown as { rowCount: number }).rowCount ?? 0} rows)`);

  console.log("\n=== Migration 0008 COMPLETE ===");
}

run().catch((err) => {
  console.error("\nMigration 0008 FAILED:", (err as Record<string, unknown>)?.cause ?? err?.message ?? err);
  process.exit(1);
});
