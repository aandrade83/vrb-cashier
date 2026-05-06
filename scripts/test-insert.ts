import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  // Find any shadow player across all cashiers
  const shadows = await sql`
    SELECT cu.id, cu.username, cu.email, cu.cashier_id, c.slug
    FROM cashier_users cu
    JOIN cashiers c ON c.id = cu.cashier_id
    WHERE cu.username LIKE '__mp__%'
    LIMIT 10
  `;
  console.log("Shadow players:", shadows);

  if (shadows.length === 0) {
    console.log("\nNo shadow players exist yet. Testing insert with a regular player...");
    const players = await sql`
      SELECT cu.id, cu.username, cu.cashier_id, c.slug
      FROM cashier_users cu
      JOIN cashiers c ON c.id = cu.cashier_id
      WHERE cu.role = 'player' AND cu.is_active = true
      LIMIT 3
    `;
    console.log("Regular players:", players);
    shadows.push(...players);
  }

  if (shadows.length === 0) {
    console.error("No players found at all");
    return;
  }

  const { id: playerId, cashier_id: cashierId } = shadows[0];

  // Get a deposit method for this cashier
  const methods = await sql`
    SELECT pm.id, pm.name
    FROM payment_methods pm
    JOIN cashier_methods cm ON cm.method_id = pm.id
    WHERE cm.cashier_id = ${cashierId}
      AND pm.type = 'deposit'
      AND pm.is_active = true
      AND pm.is_deleted = false
    LIMIT 1
  `;
  console.log("\nMethods for cashier", cashierId, ":", methods);

  if (methods.length === 0) {
    console.error("No deposit methods for cashier", cashierId);
    return;
  }

  const methodId = methods[0].id as string;
  const refCode = `TEST-${Date.now()}`;
  const idemKey = crypto.randomUUID();

  console.log("\nAttempting INSERT with:");
  console.log("  cashierId:", cashierId);
  console.log("  playerId:", playerId);
  console.log("  methodId:", methodId);

  try {
    const result = await sql`
      INSERT INTO transactions (cashier_id, reference_code, type, status, player_id, method_id, amount, currency, idempotency_key)
      VALUES (${cashierId}, ${refCode}, 'deposit', 'unassigned', ${playerId}, ${methodId}, '100.00', 'USD', ${idemKey})
      RETURNING id
    `;
    console.log("\nSUCCESS — inserted id:", result[0]?.id);
    await sql`DELETE FROM transactions WHERE id = ${result[0]?.id}`;
    console.log("Cleaned up test row.");
  } catch (err) {
    console.error("\nINSERT FAILED:", err instanceof Error ? err.message : err);
  }

  // Also test with amount = '0'
  const refCode2 = `TEST-${Date.now()}-zero`;
  const idemKey2 = crypto.randomUUID();
  console.log("\nAttempting INSERT with amount = '0':");
  try {
    const result = await sql`
      INSERT INTO transactions (cashier_id, reference_code, type, status, player_id, method_id, amount, currency, idempotency_key)
      VALUES (${cashierId}, ${refCode2}, 'deposit', 'unassigned', ${playerId}, ${methodId}, '0', 'USD', ${idemKey2})
      RETURNING id
    `;
    console.log("SUCCESS with amount=0 — inserted id:", result[0]?.id);
    await sql`DELETE FROM transactions WHERE id = ${result[0]?.id}`;
  } catch (err) {
    console.error("INSERT FAILED with amount=0:", err instanceof Error ? err.message : err);
  }
}

run().catch(console.error);
