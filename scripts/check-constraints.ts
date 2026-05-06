import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function run() {
  const rows = await db.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      cc.check_clause
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN ('transactions', 'cashier_users', 'payment_methods')
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name
  `);
  console.table(rows);
}

run().catch(console.error);
