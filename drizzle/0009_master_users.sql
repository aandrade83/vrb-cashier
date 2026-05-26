-- Migration 0009: Master users system (Phase 1 — safe/idempotent)
-- Creates master_role enum and master users table if they don't exist.
-- Adds tracking columns to cashier_users and master_sessions.

-- ============================================================
-- 1. Master role enum (safe)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'master_role') THEN
    CREATE TYPE "master_role" AS ENUM ('master_admin', 'master_clerk');
  END IF;
END $$;

-- ============================================================
-- 2. Master users table (SQL: "users") — safe, only if not exists
-- This is the master system table, NOT the cashier users.
-- ============================================================

CREATE TABLE IF NOT EXISTS "users" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email"               text NOT NULL,
  "username"            text NOT NULL,
  "password_hash"       text NOT NULL,
  "role"                "master_role" NOT NULL DEFAULT 'master_clerk',
  "is_active"           boolean NOT NULL DEFAULT true,
  "must_reset_password" boolean NOT NULL DEFAULT false,
  "last_login"          timestamp with time zone,
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "users_email_unique" UNIQUE("email"),
  CONSTRAINT "users_username_unique" UNIQUE("username")
);

CREATE UNIQUE INDEX IF NOT EXISTS "master_users_email_idx"    ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "master_users_username_idx" ON "users"("username");
CREATE INDEX        IF NOT EXISTS "master_users_role_idx"     ON "users"("role");
CREATE INDEX        IF NOT EXISTS "master_users_active_idx"   ON "users"("is_active");

-- ============================================================
-- 3. Add tracking columns to cashier_users (safe)
-- ============================================================

ALTER TABLE "cashier_users"
  ADD COLUMN IF NOT EXISTS "must_reset_password" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "last_login" timestamp with time zone;

-- ============================================================
-- 4. Extend master_sessions (safe)
-- ============================================================

ALTER TABLE "master_sessions"
  ADD COLUMN IF NOT EXISTS "master_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "login_source"   text NOT NULL DEFAULT 'env',
  ADD COLUMN IF NOT EXISTS "acting_role"    text;

-- login_source: 'env' = env root login | 'db' = users table login
-- acting_role:  NULL = admin | 'clerk' | 'player' (for master impersonation)
