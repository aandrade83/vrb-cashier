import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  // Check fields for the Amazon method (first deposit method in bitbet)
  const fields = await sql`
    SELECT id, label, field_type, method_id, is_required, display_order
    FROM method_fields
    WHERE method_id = 'bc7035ee-9995-4624-9aa3-696a55659e3d'
    ORDER BY display_order
  `;
  console.log("Fields for Amazon Gift Cards method:");
  fields.forEach((f) => console.log(JSON.stringify(f)));

  // Check all transactions (success cases)
  const txns = await sql`
    SELECT id, cashier_id, player_id, method_id, amount, status, reference_code
    FROM transactions
    WHERE cashier_id = 'fcd02ecb-b7b2-4a23-ba22-89da223f4607'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log("\nRecent transactions for bitbet:");
  txns.forEach((t) => console.log(JSON.stringify(t)));

  // Check if there's a cashier_id FK on transactions
  const pgConstraints = await sql`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'transactions'::regclass
  `;
  console.log("\nAll constraints on transactions:");
  pgConstraints.forEach((c) => console.log(c.conname, "->", c.def));
}

run().catch(console.error);
