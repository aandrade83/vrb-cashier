import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Check what migrations drizzle has recorded
  try {
    const rows = await sql`SELECT * FROM __drizzle_migrations ORDER BY created_at ASC`;
    console.log("Applied migrations in DB:");
    rows.forEach((r: Record<string, unknown>) => console.log(" -", r));
  } catch (e) {
    console.log("Could not query __drizzle_migrations:", e);
  }

  // Check current users table columns
  try {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    console.log("\nCurrent users table columns:");
    cols.forEach((c: Record<string, unknown>) =>
      console.log(`  ${c.column_name} (${c.data_type}, nullable: ${c.is_nullable})`)
    );
  } catch (e) {
    console.log("Could not query users columns:", e);
  }

  // Count users
  try {
    const [{ count }] = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`\nUsers table: ${count} rows`);
  } catch (e) {
    console.log("Could not count users:", e);
  }
}

main().catch(console.error);
