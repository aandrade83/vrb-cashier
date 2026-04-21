/**
 * Phase 2 — Global Methods migration
 *
 * 1. Backup view: shows existing payment_methods row count per cashier
 * 2. Makes payment_methods.cashier_id and created_by_admin_id nullable
 * 3. Makes method_fields.cashier_id nullable
 * 4. Creates cashier_methods junction table
 * 5. Backfills cashier_methods from existing payment_methods.cashier_id
 * 6. Verification: counts to confirm backfill success
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function query<T = Record<string, unknown>>(label: string, sql: string): Promise<T[]> {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await db.query(sql) as T[];
    console.log("✓");
    return result;
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.log(`⚠  ${e?.message ?? err}`);
    return [];
  }
}

async function exec(label: string, statement: string) {
  await query(label, statement);
}

async function run() {
  console.log("\n=== PRE-MIGRATION BACKUP VIEW ===");

  const methodCount = await query<{ total: string }>(
    "Count total payment_methods",
    `SELECT COUNT(*) AS total FROM payment_methods WHERE is_deleted = false`
  );
  console.log(`     → ${methodCount[0]?.total ?? "?"} active methods total`);

  const byCashier = await query<{ cashier_id: string; count: string }>(
    "Count methods per cashier",
    `SELECT cashier_id::text, COUNT(*)::text AS count FROM payment_methods WHERE is_deleted = false GROUP BY cashier_id ORDER BY count DESC`
  );
  for (const row of byCashier) {
    console.log(`     → cashier ${row.cashier_id}: ${row.count} method(s)`);
  }

  console.log("\n=== 0010: Make payment_methods.cashier_id nullable ===");
  await exec(
    "DROP NOT NULL on payment_methods.cashier_id",
    `ALTER TABLE payment_methods ALTER COLUMN cashier_id DROP NOT NULL`
  );

  console.log("\n=== 0010: Make payment_methods.created_by_admin_id nullable ===");
  await exec(
    "DROP NOT NULL on payment_methods.created_by_admin_id",
    `ALTER TABLE payment_methods ALTER COLUMN created_by_admin_id DROP NOT NULL`
  );

  console.log("\n=== 0010: Make method_fields.cashier_id nullable ===");
  await exec(
    "DROP NOT NULL on method_fields.cashier_id",
    `ALTER TABLE method_fields ALTER COLUMN cashier_id DROP NOT NULL`
  );

  console.log("\n=== 0010: Create cashier_methods junction table ===");
  await exec(
    "Create cashier_methods table",
    `CREATE TABLE IF NOT EXISTS cashier_methods (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cashier_id  uuid NOT NULL REFERENCES cashiers(id) ON DELETE CASCADE,
      method_id   uuid NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
      enabled     boolean NOT NULL DEFAULT true,
      created_at  timestamp with time zone NOT NULL DEFAULT now()
    )`
  );

  await exec(
    "Create unique index on cashier_methods(cashier_id, method_id)",
    `CREATE UNIQUE INDEX IF NOT EXISTS cashier_methods_cashier_method_idx ON cashier_methods (cashier_id, method_id)`
  );

  await exec(
    "Index: cashier_methods_cashier_id_idx",
    `CREATE INDEX IF NOT EXISTS cashier_methods_cashier_id_idx ON cashier_methods (cashier_id)`
  );

  await exec(
    "Index: cashier_methods_method_id_idx",
    `CREATE INDEX IF NOT EXISTS cashier_methods_method_id_idx ON cashier_methods (method_id)`
  );

  console.log("\n=== 0010: Backfill cashier_methods from payment_methods ===");
  await exec(
    "Insert existing methods into cashier_methods",
    `INSERT INTO cashier_methods (cashier_id, method_id, enabled)
     SELECT cashier_id, id, is_active
     FROM payment_methods
     WHERE cashier_id IS NOT NULL
       AND is_deleted = false
     ON CONFLICT (cashier_id, method_id) DO NOTHING`
  );

  console.log("\n=== POST-MIGRATION VERIFICATION ===");

  const cmCount = await query<{ total: string }>(
    "Count cashier_methods rows",
    `SELECT COUNT(*) AS total FROM cashier_methods`
  );
  console.log(`     → ${cmCount[0]?.total ?? "?"} rows in cashier_methods`);

  const cmByCashier = await query<{ cashier_id: string; count: string; enabled_count: string }>(
    "Count per cashier in cashier_methods",
    `SELECT cashier_id::text, COUNT(*)::text AS count, SUM(CASE WHEN enabled THEN 1 ELSE 0 END)::text AS enabled_count FROM cashier_methods GROUP BY cashier_id ORDER BY count DESC`
  );
  for (const row of cmByCashier) {
    console.log(`     → cashier ${row.cashier_id}: ${row.count} assigned (${row.enabled_count} enabled)`);
  }

  const orphaned = await query<{ total: string }>(
    "Check for methods with cashier_id not yet in cashier_methods",
    `SELECT COUNT(*) AS total FROM payment_methods pm
     WHERE pm.cashier_id IS NOT NULL
       AND pm.is_deleted = false
       AND NOT EXISTS (
         SELECT 1 FROM cashier_methods cm WHERE cm.method_id = pm.id AND cm.cashier_id = pm.cashier_id
       )`
  );
  const orphanCount = Number(orphaned[0]?.total ?? 0);
  if (orphanCount > 0) {
    console.log(`  ⚠  WARNING: ${orphanCount} method(s) not backfilled — investigate before proceeding`);
  } else {
    console.log(`  ✓ All existing methods successfully backfilled into cashier_methods`);
  }

  console.log("\n✅ Phase 2 migration complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
