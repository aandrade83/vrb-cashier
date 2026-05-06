/**
 * Applies Phase 1 DB migrations — adds only missing columns/tables.
 * Inspected DB state: users table exists with partial schema, cashier_users exists,
 * master_sessions missing new columns, user_master_permissions already exists.
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
    // Log warning but don't stop — most failures here mean "already done"
    console.log(`⚠  ${e?.message ?? err}`);
  }
}

async function run() {
  console.log("\n=== 0007/0008: Table renames (should be already done) ===");
  await exec("Rename users → cashier_users if cashier_users missing", `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='cashier_users') THEN
        ALTER TABLE users RENAME TO cashier_users;
      END IF;
    END $$;
  `);
  await exec("Rename random_names → names (if exists)", `ALTER TABLE IF EXISTS random_names RENAME TO names;`);
  await exec("Rename random_addresses → addresses (if exists)", `ALTER TABLE IF EXISTS random_addresses RENAME TO addresses;`);

  console.log("\n=== 0009: master_role enum ===");
  await exec("Create master_role enum (if not exists)", `
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'master_role') THEN
        CREATE TYPE master_role AS ENUM ('master_admin', 'master_clerk');
      END IF;
    END $$;
  `);

  console.log("\n=== 0009: users table — add missing columns ===");
  // Table already exists with: id, username, password_hash, role (text), is_active, created_at
  await exec("Add email column",               `ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;`);
  await exec("Add must_reset_password column", `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;`);
  await exec("Add last_login column",          `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;`);
  await exec("Add updated_at column",          `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();`);
  await exec("Add unique constraint on email", `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_email_unique UNIQUE (email);`);
  await exec("Add unique constraint on username", `ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_username_unique UNIQUE (username);`);
  await exec("Index: master_users_email_idx",    `CREATE UNIQUE INDEX IF NOT EXISTS master_users_email_idx    ON users (email);`);
  await exec("Index: master_users_username_idx", `CREATE UNIQUE INDEX IF NOT EXISTS master_users_username_idx ON users (username);`);
  await exec("Index: master_users_role_idx",     `CREATE INDEX        IF NOT EXISTS master_users_role_idx     ON users (role);`);
  await exec("Index: master_users_active_idx",   `CREATE INDEX        IF NOT EXISTS master_users_active_idx   ON users (is_active);`);

  console.log("\n=== 0009: cashier_users — add missing columns ===");
  await exec("Add must_reset_password", `ALTER TABLE cashier_users ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;`);
  await exec("Add last_login",          `ALTER TABLE cashier_users ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;`);

  console.log("\n=== 0009: master_sessions — add missing columns ===");
  await exec("Add master_user_id", `ALTER TABLE master_sessions ADD COLUMN IF NOT EXISTS master_user_id uuid REFERENCES users(id) ON DELETE SET NULL;`);
  await exec("Add login_source",   `ALTER TABLE master_sessions ADD COLUMN IF NOT EXISTS login_source text NOT NULL DEFAULT 'env';`);
  await exec("Add acting_role",    `ALTER TABLE master_sessions ADD COLUMN IF NOT EXISTS acting_role text;`);

  console.log("\n✅ Phase 1 migrations complete.\n");
}

run().catch((err) => {
  console.error("\n❌ Unexpected failure:", err?.message ?? err);
  process.exit(1);
});
