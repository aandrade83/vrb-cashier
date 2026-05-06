import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    UPDATE cashiers
    SET created_at = '2000-01-01 00:00:00'::timestamptz
    WHERE slug = 'vrb'
  `;
  console.log("Done — VRB createdAt set to 2000-01-01");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
