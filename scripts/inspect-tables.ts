import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function run() {
  const tables = await db`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  console.log("\n=== Tables ===");
  tables.forEach((r) => console.log(" ", r.tablename));

  const usersCols = await db`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position
  `;
  console.log("\n=== users table columns ===");
  usersCols.forEach((r) => console.log(JSON.stringify(r)));

  const cashierCols = await db`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cashier_users'
    ORDER BY ordinal_position
  `;
  console.log("\n=== cashier_users columns ===");
  cashierCols.forEach((r) => console.log(JSON.stringify(r)));

  const sessionCols = await db`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'master_sessions'
    ORDER BY ordinal_position
  `;
  console.log("\n=== master_sessions columns ===");
  sessionCols.forEach((r) => console.log(JSON.stringify(r)));
}

run().catch(console.error);
