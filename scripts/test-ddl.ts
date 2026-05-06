import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const r = await sql`CREATE TABLE IF NOT EXISTS _ddl_test (id serial primary key)`;
  console.log("create result:", r);
  const check = await sql`SELECT table_name FROM information_schema.tables WHERE table_name='_ddl_test'`;
  console.log("check:", check);
  await sql`DROP TABLE IF EXISTS _ddl_test`;
  console.log("done");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
