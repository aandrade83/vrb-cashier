import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql as drizzleSql } from "drizzle-orm";
import { readFileSync } from "fs";

const httpSql = neon(process.env.DATABASE_URL!);
const db = drizzle(httpSql);

async function main() {
  const migration = readFileSync("drizzle/0016_name_lists.sql", "utf8");

  const stripped = migration
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Running ${statements.length} statements via drizzle db.execute…`);

  for (const stmt of statements) {
    const preview = stmt.slice(0, 70).replace(/\s+/g, " ");
    try {
      await db.execute(drizzleSql.raw(stmt));
      console.log("OK:", preview);
    } catch (e: unknown) {
      const msg = (e as Error).message ?? "";
      if (msg.includes("already exists")) {
        console.log("SKIP:", preview);
      } else {
        console.error("FAIL:", preview, "→", msg);
        throw e;
      }
    }
  }

  const check = await db.execute(
    drizzleSql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'name_list%' ORDER BY table_name`
  );
  const tableNames = (check.rows as Array<{table_name: string}>).map((r) => r.table_name);
  console.log("\nTables created:", tableNames.join(", ") || "(none)");

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
