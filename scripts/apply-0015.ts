import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("\n=== 0015: Add email verification columns to users (master) table ===");

  const cols = [
    ["email_verified",            `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified            BOOLEAN     NOT NULL DEFAULT false;`],
    ["email_verified_at",         `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at         TIMESTAMPTZ;`],
    ["verification_code",         `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code         TEXT;`],
    ["verification_expires_at",   `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at   TIMESTAMPTZ;`],
    ["verification_attempts",     `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts     INTEGER     NOT NULL DEFAULT 0;`],
    ["verification_last_sent_at", `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ;`],
  ];

  for (const [label, sql] of cols) {
    process.stdout.write(`  ${label}... `);
    try {
      await db.query(sql);
      console.log("✓");
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.log(`⚠  ${e?.message ?? err}`);
    }
  }

  console.log("\n✅ Migration 0015 complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
