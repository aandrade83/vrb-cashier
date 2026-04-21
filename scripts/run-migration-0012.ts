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
  console.log("\n=== 0012: cashiers deposits_enabled / payouts_enabled ===");

  await exec(
    "Add deposits_enabled",
    `ALTER TABLE cashiers ADD COLUMN IF NOT EXISTS deposits_enabled boolean NOT NULL DEFAULT true`,
  );

  await exec(
    "Add payouts_enabled",
    `ALTER TABLE cashiers ADD COLUMN IF NOT EXISTS payouts_enabled boolean NOT NULL DEFAULT true`,
  );

  console.log("\n✅ Migration 0012 complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
