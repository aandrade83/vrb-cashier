/**
 * Creates the external_login_tokens table for the trusted external login flow.
 * Run once: npx tsx scripts/add-external-login-tokens.ts
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
  console.log("\n=== external_login_tokens table ===");

  await exec("Create table", `
    CREATE TABLE IF NOT EXISTS external_login_tokens (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      token       text NOT NULL UNIQUE,
      cashier_id  uuid NOT NULL REFERENCES cashiers(id) ON DELETE CASCADE,
      user_id     uuid NOT NULL REFERENCES cashier_users(id) ON DELETE CASCADE,
      used        boolean NOT NULL DEFAULT false,
      expires_at  timestamp with time zone NOT NULL,
      created_at  timestamp with time zone NOT NULL DEFAULT now()
    );
  `);

  await exec("Unique index on token",      `CREATE UNIQUE INDEX IF NOT EXISTS ext_login_tokens_token_idx   ON external_login_tokens (token);`);
  await exec("Index on cashier_id",        `CREATE INDEX        IF NOT EXISTS ext_login_tokens_cashier_idx ON external_login_tokens (cashier_id);`);
  await exec("Index on expires_at",        `CREATE INDEX        IF NOT EXISTS ext_login_tokens_expires_idx ON external_login_tokens (expires_at);`);

  console.log("\n✅ external_login_tokens migration complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
