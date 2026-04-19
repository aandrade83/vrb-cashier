/**
 * Clears all Clerk-based user records and their directly dependent data.
 *
 * Run AFTER migration 0005 and BEFORE migration 0006.
 *
 * Usage:
 *   CONFIRM_DELETE_CLERK_USERS=yes npx tsx scripts/migrate-clear-clerk-users.ts
 *
 * What this deletes (in FK-safe order):
 *   1. audit_logs.actor_user_id → set to NULL (rows kept, reference cleared)
 *   2. notifications → deleted (FK to users)
 *   3. transaction_updates, transaction_field_values, transaction_attachments → deleted
 *   4. transactions → deleted
 *   5. payment_methods.created_by_admin_id → set to NULL (payment method config preserved)
 *   6. users → deleted (all 20 Clerk-based users)
 *
 * Preserved: cashiers, payment_methods (config), method_fields, audit_log history,
 *            master_sessions, random_names, random_addresses
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

if (process.env.CONFIRM_DELETE_CLERK_USERS !== "yes") {
  console.error(
    "\nERROR: This script deletes all rows from the users table and dependent data.\n" +
    "Set CONFIRM_DELETE_CLERK_USERS=yes to proceed.\n"
  );
  process.exit(1);
}

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

async function exec(description: string, stmt: string) {
  const result = await db.execute(sql.raw(stmt));
  const affected = (result as unknown as { rowCount?: number }).rowCount ?? "?";
  console.log(`  ✓ ${description} (${affected} rows affected)`);
}

async function countUsers(): Promise<number> {
  const rows = await neonSql`SELECT COUNT(*)::int AS n FROM users`;
  return Number((rows[0] as { n: number }).n ?? 0);
}
async function countTransactions(): Promise<number> {
  const rows = await neonSql`SELECT COUNT(*)::int AS n FROM transactions`;
  return Number((rows[0] as { n: number }).n ?? 0);
}
async function countNotifications(): Promise<number> {
  const rows = await neonSql`SELECT COUNT(*)::int AS n FROM notifications`;
  return Number((rows[0] as { n: number }).n ?? 0);
}
async function countAuditLogs(): Promise<number> {
  const rows = await neonSql`SELECT COUNT(*)::int AS n FROM audit_logs`;
  return Number((rows[0] as { n: number }).n ?? 0);
}

async function main() {
  console.log("=== Clear Clerk Users ===\n");

  // Show what will be affected
  const userCount = await countUsers();
  const txCount = await countTransactions();
  const notifCount = await countNotifications();
  const auditCount = await countAuditLogs();

  console.log("Current state:");
  console.log(`  users:         ${userCount} rows (ALL will be deleted)`);
  console.log(`  transactions:  ${txCount} rows (ALL will be deleted)`);
  console.log(`  notifications: ${notifCount} rows (ALL will be deleted)`);
  console.log(`  audit_logs:    ${auditCount} rows (KEPT, actor reference cleared)`);
  console.log(`  payment_methods: config PRESERVED (creator reference cleared)\n`);

  if (userCount === 0) {
    console.log("Users table is already empty. Nothing to delete.");
    process.exit(0);
  }

  // Step 1: Clear user references from audit_logs (nullable — set to NULL)
  await exec(
    "Clear audit_logs.actor_user_id references",
    `UPDATE "audit_logs" SET "actor_user_id" = NULL WHERE "actor_user_id" IS NOT NULL`
  );

  // Step 2: Delete notifications (FK to users, no cascade)
  await exec(
    "Delete notifications",
    `DELETE FROM "notifications"`
  );

  // Step 3: Delete transaction child rows explicitly (some may cascade, explicit is safer)
  await exec(
    "Delete transaction_field_values",
    `DELETE FROM "transaction_field_values"`
  );
  await exec(
    "Delete transaction_attachments",
    `DELETE FROM "transaction_attachments"`
  );
  await exec(
    "Delete transaction_updates",
    `DELETE FROM "transaction_updates"`
  );

  // Step 4: Delete transactions
  await exec(
    "Delete transactions",
    `DELETE FROM "transactions"`
  );

  // Step 5: Make payment_methods.created_by_admin_id nullable, then clear the reference
  // This preserves the payment method configuration — only the creator reference is cleared
  await exec(
    "Make payment_methods.created_by_admin_id nullable",
    `ALTER TABLE "payment_methods" ALTER COLUMN "created_by_admin_id" DROP NOT NULL`
  );
  await exec(
    "Clear payment_methods.created_by_admin_id references",
    `UPDATE "payment_methods" SET "created_by_admin_id" = NULL WHERE "created_by_admin_id" IS NOT NULL`
  );

  // Step 6: Delete all users
  await exec(
    "Delete all users",
    `DELETE FROM "users"`
  );

  // Verify
  const remaining = await countUsers();
  console.log(`\n✓ Users table is now EMPTY (${remaining} rows remaining)`);

  if (remaining !== 0) {
    console.error("ERROR: Users table is not empty after deletion!");
    process.exit(1);
  }

  console.log("\n=== User deletion COMPLETE ===");
  console.log("Ready to run migration 0006.");
}

main().catch((err) => {
  console.error("\nScript failed:", err?.cause?.message ?? err?.message ?? err);
  process.exit(1);
});
