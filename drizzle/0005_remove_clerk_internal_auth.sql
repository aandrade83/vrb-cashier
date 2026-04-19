-- Migration 0005: Remove Clerk, add internal auth columns
-- Run this first. Then run scripts/migrate-clear-clerk-users.ts.
-- Then run migration 0006 to enforce NOT NULL.

-- ============================================================
-- 1. Drop Clerk-specific index and column from users
-- ============================================================

DROP INDEX IF EXISTS "users_clerk_id_idx";

ALTER TABLE "users" DROP COLUMN IF EXISTS "clerk_id";

-- ============================================================
-- 2. Make email nullable (players may not have one initially)
-- ============================================================

ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- ============================================================
-- 3. Add new auth columns as nullable (safe with existing rows)
-- ============================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;

-- ============================================================
-- 4. New table: user_sessions
-- Stores authenticated sessions for player/clerk/admin users.
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token"      text NOT NULL,
  "user_id"    uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "cashier_id" uuid NOT NULL REFERENCES "cashiers"("id") ON DELETE CASCADE,
  "role"       "user_role" NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "user_sessions_token_unique" UNIQUE("token")
);

CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx"    ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_cashier_id_idx" ON "user_sessions"("cashier_id");
CREATE INDEX IF NOT EXISTS "user_sessions_expires_at_idx" ON "user_sessions"("expires_at");

-- ============================================================
-- 5. New table: login_attempts
-- Used for rate limiting and audit logging of login events.
-- ============================================================

CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cashier_id"        uuid REFERENCES "cashiers"("id") ON DELETE CASCADE,
  "username"          text NOT NULL,
  "ip_address"        text,
  "success"           boolean NOT NULL,
  "failure_reason"    text,
  "sportsbook_checked" boolean NOT NULL DEFAULT false,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "login_attempts_lookup_idx" ON "login_attempts"("cashier_id", "username", "created_at" DESC);

-- ============================================================
-- 6. Extend master_sessions for Visit Cashier context
-- ============================================================

ALTER TABLE "master_sessions" ADD COLUMN IF NOT EXISTS "acting_cashier_id" uuid REFERENCES "cashiers"("id") ON DELETE SET NULL;
