-- Migration 0013: Rename transaction_status enum values to real business names
-- and add workflow timestamp + denied_reason columns.
--
-- PostgreSQL ALTER TYPE ... RENAME VALUE atomically renames enum values.
-- All existing rows using the old value names are updated automatically.

-- ── Rename enum values ─────────────────────────────────────────────────────────
ALTER TYPE transaction_status RENAME VALUE 'pending'        TO 'unassigned';
ALTER TYPE transaction_status RENAME VALUE 'in_progress'    TO 'pending';
ALTER TYPE transaction_status RENAME VALUE 'approved'       TO 'preconfirmed';
ALTER TYPE transaction_status RENAME VALUE 'post_confirmed' TO 'postconfirmed';
ALTER TYPE transaction_status RENAME VALUE 'rejected'       TO 'denied';
-- 'completed' and 'cancelled' keep their names

-- ── Add workflow timestamp columns ─────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS assigned_at      timestamptz,
  ADD COLUMN IF NOT EXISTS preconfirmed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS postconfirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS denied_at        timestamptz,
  ADD COLUMN IF NOT EXISTS denied_reason    text;

-- ── Update default value on status column ──────────────────────────────────────
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'unassigned';
