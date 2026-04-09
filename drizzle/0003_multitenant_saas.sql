-- =============================================================================
-- Migration: 0003_multitenant_saas
-- Multi-tenant architecture: cashiers table + cashierId on all tables
-- New field types: amount_list, hyperlink
-- New tables: random_names, random_addresses, master_sessions
-- New column: transactions.expected_amount
-- =============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: New enum values
-- ---------------------------------------------------------------------------

ALTER TYPE "public"."field_type" ADD VALUE 'amount_list';
ALTER TYPE "public"."field_type" ADD VALUE 'hyperlink';

-- ---------------------------------------------------------------------------
-- STEP 2: Create cashiers table
-- ---------------------------------------------------------------------------

CREATE TABLE "cashiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "token" text NOT NULL,
  "logo_url" text,
  "contact_email" text,
  "contact_phone" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "cashiers_slug_idx" ON "cashiers" ("slug");
CREATE UNIQUE INDEX "cashiers_token_idx" ON "cashiers" ("token");

-- ---------------------------------------------------------------------------
-- STEP 3: Insert VRB seed cashier
-- All existing data will be assigned to this cashier.
-- Token: VRB506X (7 chars, matches dev credentials theme)
-- ---------------------------------------------------------------------------

INSERT INTO "cashiers" ("id", "name", "slug", "token", "is_active", "created_at")
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'VRB Cashier',
  'vrb',
  'VRB506X',
  true,
  now()
);

-- ---------------------------------------------------------------------------
-- STEP 4: Add cashier_id to users (nullable first, then backfill, then NOT NULL)
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ADD COLUMN "cashier_id" uuid;
UPDATE "users" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "users" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "users_cashier_id_idx" ON "users" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 5: Add cashier_id to payment_methods
-- ---------------------------------------------------------------------------

ALTER TABLE "payment_methods" ADD COLUMN "cashier_id" uuid;
UPDATE "payment_methods" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "payment_methods" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "methods_cashier_id_idx" ON "payment_methods" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 6: Add cashier_id to method_fields
-- ---------------------------------------------------------------------------

ALTER TABLE "method_fields" ADD COLUMN "cashier_id" uuid;
UPDATE "method_fields" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "method_fields" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "method_fields" ADD CONSTRAINT "method_fields_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "method_fields_cashier_id_idx" ON "method_fields" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 7: Add cashier_id + expected_amount to transactions
-- ---------------------------------------------------------------------------

ALTER TABLE "transactions" ADD COLUMN "cashier_id" uuid;
ALTER TABLE "transactions" ADD COLUMN "expected_amount" numeric(14, 2);
UPDATE "transactions" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "transactions" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "txn_cashier_id_idx" ON "transactions" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 8: Add cashier_id to transaction_field_values
-- ---------------------------------------------------------------------------

ALTER TABLE "transaction_field_values" ADD COLUMN "cashier_id" uuid;
UPDATE "transaction_field_values" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "transaction_field_values" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "transaction_field_values" ADD CONSTRAINT "txn_field_values_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "txn_field_values_cashier_id_idx" ON "transaction_field_values" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 9: Add cashier_id to transaction_updates
-- ---------------------------------------------------------------------------

ALTER TABLE "transaction_updates" ADD COLUMN "cashier_id" uuid;
UPDATE "transaction_updates" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "transaction_updates" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "transaction_updates" ADD CONSTRAINT "txn_updates_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "txn_updates_cashier_id_idx" ON "transaction_updates" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 10: Add cashier_id to transaction_attachments
-- ---------------------------------------------------------------------------

ALTER TABLE "transaction_attachments" ADD COLUMN "cashier_id" uuid;
UPDATE "transaction_attachments" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "transaction_attachments" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "txn_attachments_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "attachments_cashier_id_idx" ON "transaction_attachments" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 11: Add cashier_id to audit_logs (nullable — system events may have no cashier)
-- ---------------------------------------------------------------------------

ALTER TABLE "audit_logs" ADD COLUMN "cashier_id" uuid;
UPDATE "audit_logs" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "audit_cashier_id_idx" ON "audit_logs" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 12: Add cashier_id to notifications
-- ---------------------------------------------------------------------------

ALTER TABLE "notifications" ADD COLUMN "cashier_id" uuid;
UPDATE "notifications" SET "cashier_id" = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
ALTER TABLE "notifications" ALTER COLUMN "cashier_id" SET NOT NULL;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cashier_id_fk"
  FOREIGN KEY ("cashier_id") REFERENCES "cashiers"("id");
CREATE INDEX "notif_cashier_id_idx" ON "notifications" ("cashier_id");

-- ---------------------------------------------------------------------------
-- STEP 13: Create random_names table
-- ---------------------------------------------------------------------------

CREATE TABLE "random_names" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id"),
  "value" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_locked" boolean NOT NULL DEFAULT false,
  "locked_at" timestamptz,
  "locked_by_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "random_names_cashier_id_idx" ON "random_names" ("cashier_id");
CREATE INDEX "random_names_priority_idx" ON "random_names" ("cashier_id", "priority");
CREATE INDEX "random_names_locked_idx" ON "random_names" ("is_locked");

-- ---------------------------------------------------------------------------
-- STEP 14: Create random_addresses table
-- ---------------------------------------------------------------------------

CREATE TABLE "random_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id"),
  "value" text NOT NULL,
  "priority" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "is_locked" boolean NOT NULL DEFAULT false,
  "locked_at" timestamptz,
  "locked_by_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "random_addresses_cashier_id_idx" ON "random_addresses" ("cashier_id");
CREATE INDEX "random_addresses_priority_idx" ON "random_addresses" ("cashier_id", "priority");
CREATE INDEX "random_addresses_locked_idx" ON "random_addresses" ("is_locked");

-- ---------------------------------------------------------------------------
-- STEP 15: Create master_sessions table
-- ---------------------------------------------------------------------------

CREATE TABLE "master_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX "master_sessions_token_idx" ON "master_sessions" ("token");
CREATE INDEX "master_sessions_expires_at_idx" ON "master_sessions" ("expires_at");
