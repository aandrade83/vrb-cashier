import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function exec(label: string, statement: string) {
  process.stdout.write(`  ${label}... `);
  try {
    await db.query(statement);
    console.log("✓");
  } catch (err: unknown) {
    const e = err as { message?: string };
    console.log(`⚠  ${e?.message ?? err}`);
  }
}

async function run() {
  console.log("\n=== 0011: user_cashier_permissions table ===");

  await exec(
    "Create user_cashier_permissions table",
    `CREATE TABLE IF NOT EXISTS user_cashier_permissions (
       id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       master_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       cashier_id     uuid NOT NULL REFERENCES cashiers(id) ON DELETE CASCADE,
       created_at     timestamp with time zone NOT NULL DEFAULT now()
     )`,
  );

  await exec(
    "Unique index: (master_user_id, cashier_id)",
    `CREATE UNIQUE INDEX IF NOT EXISTS ucp_user_cashier_idx
     ON user_cashier_permissions (master_user_id, cashier_id)`,
  );

  await exec(
    "Index: ucp_user_id_idx",
    `CREATE INDEX IF NOT EXISTS ucp_user_id_idx ON user_cashier_permissions (master_user_id)`,
  );

  await exec(
    "Index: ucp_cashier_id_idx",
    `CREATE INDEX IF NOT EXISTS ucp_cashier_id_idx ON user_cashier_permissions (cashier_id)`,
  );

  console.log("\n✅ Migration 0011 complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
