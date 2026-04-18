-- Migration 0006: Enforce NOT NULL on username and password_hash
-- Run ONLY after scripts/migrate-clear-clerk-users.ts has been executed.
-- This will fail if any user row still has NULL username or password_hash.

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_cashier_idx" ON "users"("cashier_id", "username");
