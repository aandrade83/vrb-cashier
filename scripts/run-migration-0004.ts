import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient);

async function exec(stmt: string) {
  await db.execute(sql.raw(stmt));
}

async function run() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "cashiers" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "slug" text NOT NULL,
      "token" text NOT NULL,
      "logo_url" text,
      "client_url" text,
      "contact_email" text,
      "contact_phone" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "cashiers_slug_unique" UNIQUE("slug"),
      CONSTRAINT "cashiers_token_unique" UNIQUE("token")
    )`,
    `CREATE TABLE IF NOT EXISTS "master_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "token" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "expires_at" timestamp with time zone NOT NULL,
      CONSTRAINT "master_sessions_token_unique" UNIQUE("token")
    )`,
    `ALTER TABLE "method_fields" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "transaction_field_values" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "transaction_attachments" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "transaction_updates" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "cashier_id" uuid`,
    `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "expected_amount" numeric(14, 2)`,
    `CREATE TABLE IF NOT EXISTS "random_names" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id"),
      "value" text NOT NULL,
      "priority" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "is_locked" boolean DEFAULT false NOT NULL,
      "locked_at" timestamp with time zone,
      "locked_by_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "random_addresses" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id"),
      "value" text NOT NULL,
      "priority" integer DEFAULT 0 NOT NULL,
      "is_active" boolean DEFAULT true NOT NULL,
      "is_locked" boolean DEFAULT false NOT NULL,
      "locked_at" timestamp with time zone,
      "locked_by_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS "random_names_cashier_id_idx" ON "random_names" ("cashier_id")`,
    `CREATE INDEX IF NOT EXISTS "random_names_priority_idx" ON "random_names" ("cashier_id","priority")`,
    `CREATE INDEX IF NOT EXISTS "random_names_locked_idx" ON "random_names" ("is_locked")`,
    `CREATE INDEX IF NOT EXISTS "random_addresses_cashier_id_idx" ON "random_addresses" ("cashier_id")`,
    `CREATE INDEX IF NOT EXISTS "random_addresses_priority_idx" ON "random_addresses" ("cashier_id","priority")`,
    `CREATE INDEX IF NOT EXISTS "random_addresses_locked_idx" ON "random_addresses" ("is_locked")`,
  ];

  for (const stmt of statements) {
    try {
      await exec(stmt);
      console.log("OK:", stmt.slice(0, 70).replace(/\s+/g, " "));
    } catch (e: any) {
      console.log("ERR:", e.message?.slice(0, 100));
    }
  }

  console.log("Done.");
}

run().catch(console.error);
