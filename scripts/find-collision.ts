import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  const rows = await sql`
    SELECT t.reference_code, t.cashier_id, c.slug
    FROM transactions t
    JOIN cashiers c ON c.id = t.cashier_id
    WHERE t.reference_code = 'DEP-2026-000001'
  `;
  console.log("DEP-2026-000001 exists in:", rows);

  // Count deposits per cashier
  const counts = await sql`
    SELECT t.cashier_id, c.slug, t.type, count(*) as n
    FROM transactions t
    JOIN cashiers c ON c.id = t.cashier_id
    GROUP BY t.cashier_id, c.slug, t.type
    ORDER BY c.slug, t.type
  `;
  console.log("\nDeposit counts per cashier:", counts);
}

run().catch(console.error);
