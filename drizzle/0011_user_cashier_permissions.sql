-- Migration 0011: user_cashier_permissions (Phase 3)
-- Controls which cashiers each DB master user can access.
-- ENV root always has full access — no row needed.

CREATE TABLE IF NOT EXISTS "user_cashier_permissions" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "master_user_id" uuid NOT NULL,
  "cashier_id"     uuid NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ucp_master_user_id_fk"
    FOREIGN KEY ("master_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
  CONSTRAINT "ucp_cashier_id_fk"
    FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ucp_user_cashier_idx"
  ON "user_cashier_permissions" ("master_user_id", "cashier_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ucp_user_id_idx"
  ON "user_cashier_permissions" ("master_user_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ucp_cashier_id_idx"
  ON "user_cashier_permissions" ("cashier_id");
