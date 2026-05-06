import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { count, eq, and } from "drizzle-orm";
import * as schema from "../src/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function run() {
  const cashierId = "fcd02ecb-b7b2-4a23-ba22-89da223f4607"; // bitbet
  const playerId = "8260e77f-7c64-4c55-98cd-bd1b762c8f60"; // __mp__alexis.andrade@gmail.com
  const methodId = "bc7035ee-9995-4624-9aa3-696a55659e3d"; // Amazon Gift Cards

  // Test getNextTransactionSequence
  const [result] = await db
    .select({ total: count() })
    .from(schema.transactions)
    .where(and(
      eq(schema.transactions.type, "deposit"),
      eq(schema.transactions.cashierId, cashierId)
    ));

  console.log("count result:", result);
  console.log("total type:", typeof result?.total);
  console.log("total value:", result?.total);

  const seq = (result?.total ?? 0) + 1;
  const year = new Date().getFullYear();
  const referenceCode = `DEP-${year}-${seq.toString().padStart(6, "0")}`;

  console.log("\nseq:", seq, "referenceCode:", referenceCode);

  // Try Drizzle insert
  const idempotencyKey = crypto.randomUUID();
  try {
    const [row] = await db
      .insert(schema.transactions)
      .values({
        cashierId,
        type: "deposit",
        status: "unassigned",
        playerId,
        methodId,
        amount: "0",
        expectedAmount: null,
        currency: "USD",
        referenceCode,
        idempotencyKey,
      })
      .returning({ id: schema.transactions.id });

    console.log("\nDrizzle INSERT SUCCESS — id:", row.id);

    // Cleanup
    await sql`DELETE FROM transactions WHERE id = ${row.id}`;
    console.log("Cleaned up.");
  } catch (err) {
    console.error("\nDrizzle INSERT FAILED:");
    console.error(err);
  }
}

run().catch(console.error);
