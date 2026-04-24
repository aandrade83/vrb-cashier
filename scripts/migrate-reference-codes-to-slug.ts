import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  // Find all transactions whose reference code uses the old year-based format
  // Pattern: DEP-YYYY-NNNNNN or PAY-YYYY-NNNNNN
  const rows = await sql`
    SELECT t.id, t.reference_code, t.type, c.slug
    FROM transactions t
    JOIN cashiers c ON c.id = t.cashier_id
    WHERE t.reference_code ~ '^(DEP|PAY)-[0-9]{4}-[0-9]{6}$'
    ORDER BY t.created_at
  `;

  if (rows.length === 0) {
    console.log("No year-based reference codes found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} transaction(s) to update.`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const prefix = row.type === "deposit" ? "DEP" : "PAY";
    const seq = row.reference_code.split("-").at(-1); // last segment e.g. "000001"
    const newRef = `${prefix}-${(row.slug as string).toUpperCase()}-${seq}`;

    // Check that the new code doesn't already exist for this cashier
    const [{ cashier_id }] = await sql`SELECT cashier_id FROM transactions WHERE id = ${row.id}`;
    const conflict = await sql`
      SELECT id FROM transactions
      WHERE cashier_id = ${cashier_id}
        AND reference_code = ${newRef}
        AND id != ${row.id}
    `;

    if (conflict.length > 0) {
      console.warn(`  SKIP ${row.reference_code} → ${newRef} (conflict with existing record)`);
      skipped++;
      continue;
    }

    await sql`
      UPDATE transactions
      SET reference_code = ${newRef}
      WHERE id = ${row.id}
    `;
    console.log(`  ${row.reference_code} → ${newRef}`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
}

run().catch(console.error);
