-- Migration 0007: Rename users → cashier_users (safe/idempotent)
-- If cashier_users already exists, the rename was already done — skip safely.

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users')
     AND NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cashier_users')
  THEN
    ALTER TABLE "users" RENAME TO "cashier_users";

    -- Rename indexes only when renaming the table
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_cashier_id_idx') THEN
      ALTER INDEX "users_cashier_id_idx" RENAME TO "cashier_users_cashier_id_idx";
    END IF;
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_role_idx') THEN
      ALTER INDEX "users_role_idx" RENAME TO "cashier_users_role_idx";
    END IF;
    IF EXISTS (SELECT FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'users_username_cashier_idx') THEN
      ALTER INDEX "users_username_cashier_idx" RENAME TO "cashier_users_username_cashier_idx";
    END IF;
  END IF;
END $$;
