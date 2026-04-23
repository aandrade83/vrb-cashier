-- Migration 0014: Add email verification columns to cashier_users
-- Players must verify their email before accessing cashier features.

ALTER TABLE cashier_users
  ADD COLUMN IF NOT EXISTS email_verified          BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_code       TEXT,
  ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_attempts   INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ;
