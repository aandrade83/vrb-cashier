import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const db = neon(process.env.DATABASE_URL!);

async function run() {
  const enums = await db`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('transaction_status', 'method_type', 'field_type', 'user_role')
    ORDER BY t.typname, e.enumsortorder
  `;
  console.log("=== Enum values in DB ===");
  enums.forEach((r) => console.log(r.typname + ":", r.enumlabel));

  const fks = await db`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid = 'transactions'::regclass
      AND contype = 'f'
  `;
  console.log("\n=== Transaction FKs ===");
  fks.forEach((r) => console.log(r.conname, "->", r.def));

  // Check transactions table columns
  const cols = await db`
    SELECT column_name, data_type, is_nullable, column_default, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions'
    ORDER BY ordinal_position
  `;
  console.log("\n=== transactions columns ===");
  cols.forEach((r) => console.log(JSON.stringify(r)));
}

run().catch(console.error);
