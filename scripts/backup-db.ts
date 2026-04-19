/**
 * Database backup script — dumps all table data as SQL INSERT statements.
 * Run: npx tsx scripts/backup-db.ts
 * Output: backup_before_auth_migration.sql
 */

import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const TABLES = [
  "cashiers",
  "users",
  "payment_methods",
  "method_fields",
  "transactions",
  "transaction_field_values",
  "transaction_updates",
  "transaction_attachments",
  "audit_logs",
  "notifications",
  "random_names",
  "random_addresses",
  "master_sessions",
];

async function queryTable(tableName: string): Promise<Record<string, unknown>[]> {
  // Must use tagged template — table names are safe (hardcoded above)
  switch (tableName) {
    case "cashiers": return sql`SELECT * FROM cashiers ORDER BY created_at ASC NULLS LAST`;
    case "users": return sql`SELECT * FROM users ORDER BY created_at ASC NULLS LAST`;
    case "payment_methods": return sql`SELECT * FROM payment_methods ORDER BY created_at ASC NULLS LAST`;
    case "method_fields": return sql`SELECT * FROM method_fields ORDER BY created_at ASC NULLS LAST`;
    case "transactions": return sql`SELECT * FROM transactions ORDER BY created_at ASC NULLS LAST`;
    case "transaction_field_values": return sql`SELECT * FROM transaction_field_values ORDER BY created_at ASC NULLS LAST`;
    case "transaction_updates": return sql`SELECT * FROM transaction_updates ORDER BY created_at ASC NULLS LAST`;
    case "transaction_attachments": return sql`SELECT * FROM transaction_attachments ORDER BY created_at ASC NULLS LAST`;
    case "audit_logs": return sql`SELECT * FROM audit_logs ORDER BY created_at ASC NULLS LAST`;
    case "notifications": return sql`SELECT * FROM notifications ORDER BY created_at ASC NULLS LAST`;
    case "random_names": return sql`SELECT * FROM random_names ORDER BY created_at ASC NULLS LAST`;
    case "random_addresses": return sql`SELECT * FROM random_addresses ORDER BY created_at ASC NULLS LAST`;
    case "master_sessions": return sql`SELECT * FROM master_sessions ORDER BY created_at ASC NULLS LAST`;
    default: throw new Error(`Unknown table: ${tableName}`);
  }
}

function toSqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function backup() {
  const lines: string[] = [];
  lines.push("-- VRB Cashier DB Backup");
  lines.push(`-- Created: ${new Date().toISOString()}`);
  lines.push("-- DO NOT EDIT — this is a safety backup before auth migration");
  lines.push("");

  let totalRows = 0;

  for (const table of TABLES) {
    process.stdout.write(`Dumping ${table}... `);
    try {
      const rows = await queryTable(table) as Record<string, unknown>[];
      console.log(`${rows.length} rows`);
      totalRows += rows.length;

      lines.push(`-- ============================================================`);
      lines.push(`-- TABLE: ${table} (${rows.length} rows)`);
      lines.push(`-- ============================================================`);

      if (rows.length === 0) {
        lines.push(`-- (empty)`);
        lines.push("");
        continue;
      }

      for (const row of rows) {
        const cols = Object.keys(row).map((k) => `"${k}"`).join(", ");
        const vals = Object.values(row).map(toSqlValue).join(", ");
        lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals});`);
      }
      lines.push("");
    } catch (err) {
      console.error(`ERROR`);
      lines.push(`-- ERROR dumping ${table}: ${err}`);
      lines.push("");
    }
  }

  const output = lines.join("\n");
  const filename = "backup_before_auth_migration.sql";
  writeFileSync(filename, output, "utf8");

  console.log(`\n✓ Backup saved to: ${filename}`);
  console.log(`  Total rows: ${totalRows}`);
  console.log(`  File size: ${(output.length / 1024).toFixed(1)} KB`);
  console.log(`\nBackup is COMPLETE. Safe to proceed with migrations.`);
}

backup().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
