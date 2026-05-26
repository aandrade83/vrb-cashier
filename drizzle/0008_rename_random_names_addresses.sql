-- Migration 0008: Rename random_names → names, random_addresses → addresses (safe)
-- Uses ALTER TABLE/INDEX IF EXISTS — safe to re-run if already renamed.

ALTER TABLE IF EXISTS "random_names" RENAME TO "names";
ALTER TABLE IF EXISTS "random_addresses" RENAME TO "addresses";

ALTER INDEX IF EXISTS "random_names_cashier_id_idx"  RENAME TO "names_cashier_id_idx";
ALTER INDEX IF EXISTS "random_names_priority_idx"    RENAME TO "names_priority_idx";
ALTER INDEX IF EXISTS "random_names_locked_idx"      RENAME TO "names_locked_idx";

ALTER INDEX IF EXISTS "random_addresses_cashier_id_idx" RENAME TO "addresses_cashier_id_idx";
ALTER INDEX IF EXISTS "random_addresses_priority_idx"   RENAME TO "addresses_priority_idx";
ALTER INDEX IF EXISTS "random_addresses_locked_idx"     RENAME TO "addresses_locked_idx";
