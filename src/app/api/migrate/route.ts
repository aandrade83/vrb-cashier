import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET() {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "MIGRATE_SECRET env var not set" }, { status: 500 });
  }
  return NextResponse.json({ error: "Use POST with { secret }" }, { status: 405 });
}

export async function POST(req: Request) {
  const secret = process.env.MIGRATE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "MIGRATE_SECRET env var not set" }, { status: 500 });
  }

  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.secret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  const steps: { step: string; status: string }[] = [];

  async function exec(step: string, statement: string) {
    try {
      await sql.query(statement);
      steps.push({ step, status: "ok" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({ step, status: `warning: ${msg}` });
    }
  }

  await exec(
    "Drop NOT NULL: payment_methods.cashier_id",
    `ALTER TABLE payment_methods ALTER COLUMN cashier_id DROP NOT NULL`,
  );

  await exec(
    "Drop NOT NULL: payment_methods.created_by_admin_id",
    `ALTER TABLE payment_methods ALTER COLUMN created_by_admin_id DROP NOT NULL`,
  );

  await exec(
    "Drop NOT NULL: method_fields.cashier_id",
    `ALTER TABLE method_fields ALTER COLUMN cashier_id DROP NOT NULL`,
  );

  await exec(
    "Create cashier_methods table",
    `CREATE TABLE IF NOT EXISTS cashier_methods (
       id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       cashier_id  uuid NOT NULL REFERENCES cashiers(id) ON DELETE CASCADE,
       method_id   uuid NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
       enabled     boolean NOT NULL DEFAULT true,
       created_at  timestamp with time zone NOT NULL DEFAULT now()
     )`,
  );

  await exec(
    "Unique index: cashier_methods(cashier_id, method_id)",
    `CREATE UNIQUE INDEX IF NOT EXISTS cashier_methods_cashier_method_idx
     ON cashier_methods (cashier_id, method_id)`,
  );

  await exec(
    "Index: cashier_methods_cashier_id_idx",
    `CREATE INDEX IF NOT EXISTS cashier_methods_cashier_id_idx ON cashier_methods (cashier_id)`,
  );

  await exec(
    "Index: cashier_methods_method_id_idx",
    `CREATE INDEX IF NOT EXISTS cashier_methods_method_id_idx ON cashier_methods (method_id)`,
  );

  await exec(
    "Backfill cashier_methods from payment_methods",
    `INSERT INTO cashier_methods (cashier_id, method_id, enabled)
     SELECT cashier_id, id, is_active
     FROM payment_methods
     WHERE cashier_id IS NOT NULL AND is_deleted = false
     ON CONFLICT (cashier_id, method_id) DO NOTHING`,
  );

  const allOk = steps.every((s) => s.status === "ok");
  return NextResponse.json({ ok: allOk, steps });
}
