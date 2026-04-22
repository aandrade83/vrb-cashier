/**
 * Migration 0013: Rename transaction_status enum values + add workflow columns.
 */
import "dotenv/config";
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
  console.log("\n=== 0013: Rename transaction_status enum values ===");
  await exec("pending → unassigned",        `ALTER TYPE transaction_status RENAME VALUE 'pending'        TO 'unassigned';`);
  await exec("in_progress → pending",       `ALTER TYPE transaction_status RENAME VALUE 'in_progress'    TO 'pending';`);
  await exec("approved → preconfirmed",     `ALTER TYPE transaction_status RENAME VALUE 'approved'       TO 'preconfirmed';`);
  await exec("post_confirmed → postconfirmed", `ALTER TYPE transaction_status RENAME VALUE 'post_confirmed' TO 'postconfirmed';`);
  await exec("rejected → denied",           `ALTER TYPE transaction_status RENAME VALUE 'rejected'       TO 'denied';`);

  console.log("\n=== 0013: Add workflow timestamp + denial columns ===");
  await exec("assigned_at",      `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS assigned_at      timestamptz;`);
  await exec("preconfirmed_at",  `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS preconfirmed_at  timestamptz;`);
  await exec("postconfirmed_at", `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS postconfirmed_at timestamptz;`);
  await exec("completed_at",     `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS completed_at     timestamptz;`);
  await exec("denied_at",        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS denied_at        timestamptz;`);
  await exec("denied_reason",    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS denied_reason    text;`);

  console.log("\n=== 0013: Update default status value ===");
  await exec("Set default to unassigned", `ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'unassigned';`);

  console.log("\n✅ Migration 0013 complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Migration failed:", err?.message ?? err);
  process.exit(1);
});
