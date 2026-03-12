# Task: Build the Clerk Role Module — Transaction Queue

## Context
This is the VRB Cashier app built with Next.js (App Router), TypeScript, Tailwind CSS, Clerk for auth, Drizzle ORM, and Neon PostgreSQL. Before writing any code read:
- `db/schema.ts` — understand all tables especially `transactions`, `transaction_updates`, `users`, `notifications`
- `docs/SECURITY.md` — follow all rules without exception

---

## What to build
The complete Clerk workflow:
1. `/clerk-role/queue` — live transaction queue, always shows pending transactions
2. `/clerk-role/queue/[transactionId]` — transaction detail, lock system, status update, email notification
3. Server actions: lock transaction, update status, send email
4. Email notification to player via Resend

---

## 1. Page: `/clerk-role/queue` — Transaction Queue

**File:** `app/(clerk-role)/clerk-role/queue/page.tsx`

This is a Server Component wrapped with auto-refresh behavior.

### Data to fetch:
Query `transactions` where `status = "pending"` OR `status = "in_progress"`, joined with:
- `users` (player info: email, firstName, lastName)
- `payment_methods` (method name and type)
- `users` again for `locked_by_clerk_id` (clerk name who has it locked)

Order by: `created_at` ascending (oldest first — FIFO queue).

### Table columns to display:
| Column | Source |
|---|---|
| Reference Code | `transactions.reference_code` |
| Type | `transactions.type` — show as badge: "Deposit" (green) or "Payout" (orange) |
| Method | `payment_methods.name` |
| Player | `users.first_name + last_name` or email |
| Amount | `transactions.amount` + `transactions.currency` |
| Submitted | `transactions.created_at` — show as relative time (e.g. "5 min ago") |
| Status | `transactions.status` — badge: "Pending" (yellow) or "In Progress" (blue) |
| Handled By | If `locked_by_clerk_id` is set: show clerk's name. If null: show "—" |
| Action | Button — see logic below |

### Action button logic per row:
- If `locked_by_clerk_id` is NULL → show button **"Open"** (primary style)
- If `locked_by_clerk_id` = current clerk's user id → show button **"Continue"** (primary style)
- If `locked_by_clerk_id` = a different clerk → show button **"Take Over"** (secondary/warning style)

Clicking any of these buttons navigates to `/clerk-role/queue/[transactionId]`.

### Auto-refresh:
Use `revalidatePath` after every action so the list updates automatically.

### Empty state:
"No pending transactions. The queue is clear."

---

## 2. Page: `/clerk-role/queue/[transactionId]` — Transaction Detail

**File:** `app/(clerk-role)/clerk-role/queue/[transactionId]/page.tsx`

Server Component that:
- Verifies caller has role `clerk`
- Fetches the full transaction with all relations
- **On page load**, calls `lockTransaction` to assign the lock to the current clerk
- Passes all data to a Client Component

### Page layout — 2 column on desktop, stacked on mobile:

**Left column — Transaction Info (read only):**
- Header: Reference code + type badge + status badge
- Player info: name, email
- Method: name + type
- Amount + currency
- Submitted date/time
- Section: "Form Submission" — renders each field as label → value pairs. Must show the PLAYER ACCOUNT field from each method. For image/file fields: show clickable thumbnail or download link.
- Section: "Update History" — timeline of all `transaction_updates` showing: date, clerk name, previous → new status, note to player

**Right column — Clerk Action Panel:**
- Lock status banner (see Section 3)
- Status update form (see Section 5)

---

## 3. Lock Status Banner

**Case A — Lock is free or belongs to current clerk:**
Green banner: "You are handling this transaction."

**Case B — Lock belongs to a different clerk AND not expired:**
Yellow warning banner: "This transaction is currently being handled by [clerk full name] since [lockedAt time]."
Two buttons: "Take Over" (primary) + "Back to Queue" (secondary)
"Take Over" opens a confirmation dialog before calling `takeOverTransaction`.

**Case C — Lock exists but `lock_expires_at` is in the past:**
Treat as free — auto-acquire silently.

---

## 4. Server Action: `lockTransaction`

**File:** `app/(clerk-role)/clerk-role/queue/actions.ts`

1. Verify caller has role `clerk`
2. Get current clerk's local user record
3. Fetch current lock state
4. If NULL or expired → acquire lock:
   - Set `locked_by_clerk_id`, `locked_at`, `lock_expires_at = now + 30min`
   - Set `status = "in_progress"` if was `"pending"`
   - Write audit log: `transaction.locked`
   - Return `{ acquired: true, lockedBy: currentClerk }`
5. If locked by different clerk and not expired → return `{ acquired: false, lockedBy: existingClerkInfo }`

### `takeOverTransaction`:
Force-acquires lock regardless of current holder. Writes audit log: `transaction.taken_over`.

### `renewLock`:
Resets `lock_expires_at` to now + 30 min. Called from client every 10 minutes via `setInterval`.

---

## 5. Status Update Form

**File:** `app/(clerk-role)/clerk-role/queue/[transactionId]/_components/UpdateForm.tsx`

Client Component. Only enabled if current clerk owns the lock.

Fields:
- **New Status** — dropdown: Approved, Rejected, Completed (not Pending/In Progress)
- **Note to Player** — textarea, required, min 10 chars (sent via email + shown in player history)
- **Internal Note** — textarea, optional (not shown to player)

Submit button: "Update & Notify Player" — disabled if invalid or no lock ownership.

---

## 6. Server Action: `updateTransactionStatus`

Steps:
1. Auth — verify role `clerk`
2. Zod validate all inputs
3. Verify lock ownership — throw if current clerk does not own it
4. Verify valid status transition — terminal statuses (completed, rejected) are immutable
5. Update transaction: set new status, internal note, release lock (set locked fields to NULL)
6. Insert `transaction_updates` row
7. Send email via `sendStatusUpdateEmail` — on failure store error in `email_error`, do NOT block
8. Insert `notifications` row for the player
9. Write audit log: `transaction.status_updated`
10. Revalidate `/clerk-role/queue`
11. Redirect to `/clerk-role/queue`

---

## 7. Email: `sendStatusUpdateEmail`

**File:** `lib/email/sendStatusUpdate.ts`

Use Resend. Add to `.env.local`:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=cashier@yourdomain.com
```

Email content:
- Subject: `Your {type} request {referenceCode} has been {newStatus}`
- Body: player name greeting, transaction summary (ref, amount, status), clerk message, "View Transaction" button
- Footer: automated notification disclaimer

---

## 8. Folder structure

```
app/
  (clerk-role)/
    clerk-role/
      queue/
        page.tsx
        actions.ts
        [transactionId]/
          page.tsx
          _components/
            UpdateForm.tsx
            LockBanner.tsx
            TakeOverDialog.tsx
lib/
  email/
    sendStatusUpdate.ts
```

---

## 9. Security rules

- Role `clerk` verified server-side on every route and action
- Lock ownership verified in `updateTransactionStatus` before any DB write
- Terminal statuses (completed, rejected) are immutable — enforce server-side
- Email errors must NOT block the status update
- All mutations write to `audit_logs`
- Follow all rules in `docs/SECURITY.md`

---

## Done when:
- [ ] `/clerk-role/queue` shows all pending and in_progress transactions
- [ ] Columns: reference, type, method, player, amount, status, handled by, action
- [ ] "Open" acquires lock and navigates to detail
- [ ] "Take Over" shows confirmation dialog then force-acquires lock
- [ ] Detail page shows all submitted form field values (including PLAYER ACCOUNT field) and file attachments
- [ ] Lock banner shows correctly for all 3 cases
- [ ] Lock auto-renews every 10 minutes
- [ ] Update form only enables when current clerk owns lock
- [ ] Status updated to approved, rejected, or completed
- [ ] On update: transaction_updates inserted, email sent, notification created, lock released
- [ ] Queue auto-refreshes after every update
- [ ] All actions verify clerk role and lock ownership server-side
