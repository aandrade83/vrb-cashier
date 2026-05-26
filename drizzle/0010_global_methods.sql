-- Migration 0010: Global methods + cashier_methods junction (Phase 2)
-- Makes payment_methods.cashier_id and created_by_admin_id nullable (for master-created global methods).
-- Makes method_fields.cashier_id nullable.
-- Creates cashier_methods junction table.
-- Backfills cashier_methods from existing payment_methods rows.

-- 1. Make cashier_id nullable on payment_methods
ALTER TABLE "payment_methods" ALTER COLUMN "cashier_id" DROP NOT NULL;
--> statement-breakpoint

-- 2. Make created_by_admin_id nullable on payment_methods
ALTER TABLE "payment_methods" ALTER COLUMN "created_by_admin_id" DROP NOT NULL;
--> statement-breakpoint

-- 3. Make cashier_id nullable on method_fields
ALTER TABLE "method_fields" ALTER COLUMN "cashier_id" DROP NOT NULL;
--> statement-breakpoint

-- 4. Create cashier_methods junction table
CREATE TABLE IF NOT EXISTS "cashier_methods" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cashier_id" uuid NOT NULL,
  "method_id"  uuid NOT NULL,
  "enabled"    boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "cashier_methods_cashier_id_cashiers_id_fk"
    FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE CASCADE,
  CONSTRAINT "cashier_methods_method_id_payment_methods_id_fk"
    FOREIGN KEY ("method_id") REFERENCES "public"."payment_methods"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "cashier_methods_cashier_method_idx"
  ON "cashier_methods" ("cashier_id", "method_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cashier_methods_cashier_id_idx"
  ON "cashier_methods" ("cashier_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "cashier_methods_method_id_idx"
  ON "cashier_methods" ("method_id");
--> statement-breakpoint

-- 5. Backfill cashier_methods from existing payment_methods
INSERT INTO "cashier_methods" ("cashier_id", "method_id", "enabled")
SELECT "cashier_id", "id", "is_active"
FROM "payment_methods"
WHERE "cashier_id" IS NOT NULL
  AND "is_deleted" = false
ON CONFLICT ("cashier_id", "method_id") DO NOTHING;
