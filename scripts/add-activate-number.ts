import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Adding activate_number column to payment_methods...");
  await sql`
    ALTER TABLE payment_methods
    ADD COLUMN IF NOT EXISTS activate_number integer NOT NULL DEFAULT 1
  `;
  console.log("Done.");
}

run().catch(console.error);
