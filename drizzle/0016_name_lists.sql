-- Migration 0016: Name Lists
-- Method-scoped, multi-cashier-shared name pools with blocking modes.
-- Replaces the flat per-cashier names pool for the "name" field type.

-- ── name_lists ────────────────────────────────────────────────────────────────
CREATE TABLE "name_lists" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "method_id"     uuid NOT NULL REFERENCES "payment_methods"("id") ON DELETE CASCADE,
  "blocking_mode" text NOT NULL DEFAULT 'yes',
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "name_lists_method_id_idx" ON "name_lists" ("method_id");

-- ── name_list_cashiers ────────────────────────────────────────────────────────
-- method_id is denormalized from name_lists to allow a simple UNIQUE constraint
-- enforcing "only one list per method+cashier" without a JOIN.
CREATE TABLE "name_list_cashiers" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name_list_id"   uuid NOT NULL REFERENCES "name_lists"("id") ON DELETE CASCADE,
  "cashier_id"     uuid NOT NULL REFERENCES "cashiers"("id") ON DELETE CASCADE,
  "method_id"      uuid NOT NULL REFERENCES "payment_methods"("id") ON DELETE CASCADE,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "name_list_cashiers_method_cashier_idx"
  ON "name_list_cashiers" ("method_id", "cashier_id");

CREATE INDEX "name_list_cashiers_list_id_idx"   ON "name_list_cashiers" ("name_list_id");
CREATE INDEX "name_list_cashiers_cashier_id_idx" ON "name_list_cashiers" ("cashier_id");

-- ── name_list_names ───────────────────────────────────────────────────────────
CREATE TABLE "name_list_names" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name_list_id"              uuid NOT NULL REFERENCES "name_lists"("id") ON DELETE CASCADE,
  "value"                     text NOT NULL,
  "value_normalized"          text NOT NULL,
  "priority"                  integer NOT NULL DEFAULT 1,
  "is_active"                 boolean NOT NULL DEFAULT true,
  "is_locked"                 boolean NOT NULL DEFAULT false,
  "locked_at"                 timestamptz,
  "locked_by_transaction_id"  uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  "last_used_at"              timestamptz,
  "last_used_reference"       text,
  "created_at"                timestamptz NOT NULL DEFAULT now(),
  "updated_at"                timestamptz NOT NULL DEFAULT now()
);

-- Prevents "Alex", " alex ", "ALEX" from coexisting in the same list
CREATE UNIQUE INDEX "name_list_names_list_value_idx"
  ON "name_list_names" ("name_list_id", "value_normalized");

CREATE INDEX "name_list_names_list_id_idx"
  ON "name_list_names" ("name_list_id", "is_active", "is_locked", "priority");

CREATE INDEX "name_list_names_locked_by_idx"
  ON "name_list_names" ("locked_by_transaction_id");
