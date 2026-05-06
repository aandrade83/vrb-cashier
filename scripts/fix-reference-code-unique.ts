import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Dropping global unique constraint on reference_code...");
  await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_reference_code_unique`;

  console.log("Dropping old unique index txn_reference_code_idx...");
  await sql`DROP INDEX IF EXISTS txn_reference_code_idx`;

  console.log("Creating composite unique index on (cashier_id, reference_code)...");
  await sql`CREATE UNIQUE INDEX txn_reference_code_idx ON transactions (cashier_id, reference_code)`;

  console.log("Done. Verifying...");
  const constraints = await sql`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'transactions'::regclass
      AND conname LIKE '%reference%'
  `;
  console.log("Remaining reference_code constraints:", constraints);

  const indexes = await sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'transactions' AND indexname LIKE '%reference%'
  `;
  console.log("Reference code indexes:", indexes);
}

run().catch(console.error);
