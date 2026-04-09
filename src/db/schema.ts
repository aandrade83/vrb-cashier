// =============================================================================
// VRB Cashier — Drizzle ORM Schema
// Database: PostgreSQL hosted on Neon
// Run migrations: npx drizzle-kit generate && npx drizzle-kit migrate
// =============================================================================

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  decimal,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// ENUMS
// =============================================================================

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "clerk",
  "player",
]);

export const methodTypeEnum = pgEnum("method_type", [
  "deposit",
  "payout",
]);

export const fieldTypeEnum = pgEnum("field_type", [
  "text",          // single-line textbox
  "textarea",      // multi-line textbox
  "number",        // numeric input
  "dropdown",      // select with predefined options
  "file",          // file upload (PDF, DOC, etc.)
  "image",         // image upload (JPG, PNG, etc.)
  "date",          // date picker
  "checkbox",      // boolean toggle
  "label",         // static display text, no user input
  "hidden_label",  // collapsible content block, toggle shows placeholder text
  "random_list",   // shows a random value from dropdownOptions on each form load
  "amount_list",   // buttons that set the amount field value
  "hyperlink",     // clickable link opening in new tab
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",      // submitted by player, no clerk assigned (UI: pre_confirmed)
  "in_progress",  // clerk locked and is working on it
  "approved",     // clerk approved (UI: post_confirmed)
  "rejected",     // clerk rejected (UI: denied)
  "completed",    // fully processed and closed
  "cancelled",    // cancelled by player before processing
]);

// =============================================================================
// CASHIERS
// Each cashier is an isolated tenant. All data is scoped to a cashier.
// Access is via /{slug}/{token}/* routes.
// =============================================================================

export const cashiers = pgTable(
  "cashiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    name: text("name").notNull(),                     // e.g. "VRB Cashier"
    slug: text("slug").notNull().unique(),             // 3-letter code, e.g. "vrb"
    token: text("token").notNull().unique(),           // 7-char access token

    logoUrl: text("logo_url"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cashiers_slug_idx").on(table.slug),
    uniqueIndex("cashiers_token_idx").on(table.token),
  ]
);

// =============================================================================
// USERS
// Table stores a local mirror of Clerk users so we can join with transactions,
// audits, and reports without calling the Clerk API every time.
// Source of truth for auth is always Clerk — this table is read-only from
// the app's perspective (populated and updated via Clerk webhooks).
// =============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Which cashier this user belongs to
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    // Clerk's own user ID — used to link sessions to this record
    clerkId: text("clerk_id").notNull().unique(),

    role: userRoleEnum("role").notNull().default("player"),

    email: text("email").notNull(),
    firstName: text("first_name"),
    lastName: text("last_name"),
    avatarUrl: text("avatar_url"),

    isActive: boolean("is_active").notNull().default(true),

    // Populated only for clerk/admin rows — tracks who created this user
    createdByAdminId: uuid("created_by_admin_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("users_cashier_id_idx").on(table.cashierId),
    index("users_clerk_id_idx").on(table.clerkId),
    index("users_role_idx").on(table.role),
  ]
);

// =============================================================================
// PAYMENT METHODS
// Configured entirely by Admin. A method belongs to either deposit or payout.
// Field definitions are stored in the `method_fields` table (normalized).
// =============================================================================

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Which cashier this method belongs to
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    name: text("name").notNull(),                    // e.g. "Bank Transfer", "USDT TRC-20"
    type: methodTypeEnum("type").notNull(),           // "deposit" | "payout"
    description: text("description"),                // optional instructions shown to player
    logoUrl: text("logo_url"),                       // optional icon/logo for the method

    isActive: boolean("is_active").notNull().default(false), // Admin must explicitly activate

    // Soft-delete: deactivated methods remain visible in historical transactions
    isDeleted: boolean("is_deleted").notNull().default(false),

    createdByAdminId: uuid("created_by_admin_id")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("methods_cashier_id_idx").on(table.cashierId),
    index("methods_type_idx").on(table.type),
    index("methods_active_idx").on(table.isActive),
  ]
);

// =============================================================================
// METHOD FIELDS
// Each payment method has N custom fields. Normalized: one row per field.
// This allows Admin to add/remove/reorder fields without touching the method row.
// =============================================================================

export const methodFields = pgTable(
  "method_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Denormalized cashierId for direct isolation queries without method join
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    methodId: uuid("method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),

    label: text("label").notNull(),             // shown to the player, e.g. "Account Number"
    placeholder: text("placeholder"),           // input hint text
    fieldType: fieldTypeEnum("field_type").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0), // controls render order

    // Used when fieldType = "dropdown" | "random_list" | "amount_list"
    // Stored as JSON array of strings: ["Option A", "Option B", "Option C"]
    dropdownOptions: jsonb("dropdown_options"),

    // Used when fieldType = "file" or "image"
    // JSON: { maxSizeMb: 5, allowedExtensions: ["pdf", "jpg", "png"] }
    fileConfig: jsonb("file_config"),

    // Additional validation rules
    // JSON: { minLength: 5, maxLength: 50, pattern: "^[0-9]+$", min: 0, max: 99999 }
    validationRules: jsonb("validation_rules"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("method_fields_cashier_id_idx").on(table.cashierId),
    index("method_fields_method_id_idx").on(table.methodId),
    index("method_fields_order_idx").on(table.methodId, table.displayOrder),
  ]
);

// =============================================================================
// TRANSACTIONS
// One row per deposit or payout request submitted by a Player.
//
// STATUS SEMANTIC MAPPING (UI labels):
//   pending      → "Pre-confirmed"  (player submitted)
//   in_progress  → "In progress"    (clerk locked)
//   approved     → "Post-confirmed" (clerk approved)
//   rejected     → "Denied"         (clerk/admin rejected)
//   completed    → "Completed"      (admin closed)
//   cancelled    → "Cancelled"      (player cancelled)
// =============================================================================

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Which cashier this transaction belongs to
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    // Human-readable reference shown to the player, e.g. "TXN-2024-000123"
    referenceCode: text("reference_code").notNull().unique(),

    type: methodTypeEnum("type").notNull(),          // "deposit" | "payout"

    status: transactionStatusEnum("status")
      .notNull()
      .default("pending"),

    // Player who submitted the transaction
    playerId: uuid("player_id")
      .notNull()
      .references(() => users.id),

    // The method chosen by the player (e.g. "Bank Transfer")
    methodId: uuid("method_id")
      .notNull()
      .references(() => paymentMethods.id),

    // Monetary amount — stored as exact decimal, never float
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),

    // Expected amount for validation: received amount must be <= expectedAmount
    expectedAmount: decimal("expected_amount", { precision: 14, scale: 2 }),

    // Currency code, e.g. "USD", "EUR", "USDT"
    currency: text("currency").notNull().default("USD"),

    // -------------------------------------------------------------------------
    // CLERK LOCK SYSTEM
    // Only one clerk can work on a transaction at a time.
    // -------------------------------------------------------------------------

    // Which clerk currently has this transaction locked
    lockedByClerkId: uuid("locked_by_clerk_id").references(() => users.id),

    // When the lock was acquired — used to compute expiry
    lockedAt: timestamp("locked_at", { withTimezone: true }),

    // Lock auto-expires after 30 min — stored explicitly for easy DB queries
    lockExpiresAt: timestamp("lock_expires_at", { withTimezone: true }),

    // -------------------------------------------------------------------------
    // ADMIN / CLERK INTERNAL COMMENT
    // Latest note left by the clerk when processing — also stored historically
    // in transaction_updates. This column is a convenience denormalized copy
    // of the most recent update note for quick display in the queue.
    // -------------------------------------------------------------------------
    internalNote: text("internal_note"),

    // Idempotency key to prevent duplicate submissions from the player
    idempotencyKey: text("idempotency_key").unique(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("txn_cashier_id_idx").on(table.cashierId),
    index("txn_player_id_idx").on(table.playerId),
    index("txn_status_idx").on(table.status),
    index("txn_type_idx").on(table.type),
    index("txn_locked_by_idx").on(table.lockedByClerkId),
    index("txn_created_at_idx").on(table.createdAt),
    uniqueIndex("txn_reference_code_idx").on(table.referenceCode),
  ]
);

// =============================================================================
// TRANSACTION FIELD VALUES
// Player's actual answers for each method field.
// Normalized: one row per field answer. Allows querying individual field values.
// Text values are stored as-is. File/image fields store the uploaded file URL.
// =============================================================================

export const transactionFieldValues = pgTable(
  "transaction_field_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),

    // Reference to the field definition — kept for label/type context in history
    methodFieldId: uuid("method_field_id")
      .notNull()
      .references(() => methodFields.id),

    // Snapshot of the field label at submission time
    // (field label may change after submission — this preserves history)
    fieldLabelSnapshot: text("field_label_snapshot").notNull(),

    // Snapshot of the field type at submission time
    fieldTypeSnapshot: fieldTypeEnum("field_type_snapshot").notNull(),

    // All values stored as text:
    // - text/textarea/number/date/dropdown → plain string
    // - checkbox → "true" or "false"
    // - file/image → URL to uploaded file in storage (e.g. Vercel Blob or S3)
    value: text("value"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("txn_field_values_cashier_id_idx").on(table.cashierId),
    index("txn_field_values_txn_id_idx").on(table.transactionId),
    index("txn_field_values_field_id_idx").on(table.methodFieldId),
  ]
);

// =============================================================================
// TRANSACTION UPDATES (AUDIT TRAIL)
// Every status change made by a Clerk is recorded here.
// This is immutable — rows are never updated, only inserted.
// The player sees these updates in their Transactions view.
// Emails to the player are also triggered from here.
// =============================================================================

export const transactionUpdates = pgTable(
  "transaction_updates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),

    // Who made the change (clerk or admin)
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id),

    previousStatus: transactionStatusEnum("previous_status").notNull(),
    newStatus: transactionStatusEnum("new_status").notNull(),

    // Note visible to the player in their transaction history
    noteToPlayer: text("note_to_player"),

    // Internal note visible only to Admin and Clerk
    internalNote: text("internal_note"),

    // Email notification tracking
    emailSentToPlayer: boolean("email_sent_to_player")
      .notNull()
      .default(false),
    emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
    emailError: text("email_error"), // stores error message if email failed

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("txn_updates_cashier_id_idx").on(table.cashierId),
    index("txn_updates_txn_id_idx").on(table.transactionId),
    index("txn_updates_user_id_idx").on(table.updatedByUserId),
    index("txn_updates_created_at_idx").on(table.createdAt),
  ]
);

// =============================================================================
// TRANSACTION ATTACHMENTS
// Files or images uploaded by the player as part of a transaction.
// Stored separately so the transaction row stays lean and attachments
// can be listed, previewed, and managed independently.
// =============================================================================

export const transactionAttachments = pgTable(
  "transaction_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),

    // The field this file belongs to
    methodFieldId: uuid("method_field_id")
      .notNull()
      .references(() => methodFields.id),

    fileName: text("file_name").notNull(),         // original filename
    fileType: text("file_type").notNull(),          // MIME type, e.g. "image/png"
    fileSizeBytes: integer("file_size_bytes"),
    fileUrl: text("file_url").notNull(),            // URL in Vercel Blob / S3 / Cloudinary

    uploadedByPlayerId: uuid("uploaded_by_player_id")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachments_cashier_id_idx").on(table.cashierId),
    index("attachments_txn_id_idx").on(table.transactionId),
  ]
);

// =============================================================================
// AUDIT LOGS
// System-wide immutable log for every critical action.
// Used for security auditing, compliance, and debugging.
// Covers: logins, user management, method changes, and all transaction events.
// =============================================================================

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .references(() => cashiers.id),

    // Who performed the action — null for system/webhook actions
    actorUserId: uuid("actor_user_id").references(() => users.id),
    actorRole: userRoleEnum("actor_role"),

    // What happened, e.g. "transaction.status_changed", "method.created", "user.login"
    action: text("action").notNull(),

    // Which entity was affected
    entityType: text("entity_type"),   // "transaction" | "method" | "user" | "method_field"
    entityId: uuid("entity_id"),       // ID of the affected row

    // Additional context as JSON — never include sensitive data (no CVV, no passwords)
    metadata: jsonb("metadata"),

    // Request context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_cashier_id_idx").on(table.cashierId),
    index("audit_actor_idx").on(table.actorUserId),
    index("audit_action_idx").on(table.action),
    index("audit_entity_idx").on(table.entityType, table.entityId),
    index("audit_created_at_idx").on(table.createdAt),
  ]
);

// =============================================================================
// NOTIFICATIONS
// Tracks every notification sent or queued for a user.
// Decoupled from transaction_updates so other notification types can be added.
// =============================================================================

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    // Who receives the notification
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Source event that triggered the notification
    transactionId: uuid("transaction_id").references(() => transactions.id),
    transactionUpdateId: uuid("transaction_update_id").references(
      () => transactionUpdates.id
    ),

    // "email" | "in_app" — extendable for future channels (SMS, push)
    channel: text("channel").notNull().default("in_app"),

    title: text("title").notNull(),
    body: text("body").notNull(),

    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),

    // Delivery tracking for email/external channels
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveryError: text("delivery_error"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("notif_cashier_id_idx").on(table.cashierId),
    index("notif_user_id_idx").on(table.userId),
    index("notif_unread_idx").on(table.userId, table.isRead),
    index("notif_txn_id_idx").on(table.transactionId),
  ]
);

// =============================================================================
// RANDOM NAMES
// Pool of names assigned to transactions for anonymization per cashier.
// Lowest priority number = highest priority for assignment.
// =============================================================================

export const randomNames = pgTable(
  "random_names",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    value: text("value").notNull(),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    // Lock system: prevents concurrent assignment of the same name
    isLocked: boolean("is_locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedByTransactionId: uuid("locked_by_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" }
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("random_names_cashier_id_idx").on(table.cashierId),
    index("random_names_priority_idx").on(table.cashierId, table.priority),
    index("random_names_locked_idx").on(table.isLocked),
  ]
);

// =============================================================================
// RANDOM ADDRESSES
// Pool of addresses assigned to transactions per cashier.
// Same lock logic as random_names.
// =============================================================================

export const randomAddresses = pgTable(
  "random_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    value: text("value").notNull(),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),

    isLocked: boolean("is_locked").notNull().default(false),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedByTransactionId: uuid("locked_by_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" }
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("random_addresses_cashier_id_idx").on(table.cashierId),
    index("random_addresses_priority_idx").on(table.cashierId, table.priority),
    index("random_addresses_locked_idx").on(table.isLocked),
  ]
);

// =============================================================================
// MASTER SESSIONS
// Session tokens for the /master/* routes (no Clerk, simple cookie auth).
// =============================================================================

export const masterSessions = pgTable(
  "master_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("master_sessions_token_idx").on(table.token),
    index("master_sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// =============================================================================
// RELATIONS
// Drizzle relation definitions — used by the query builder (db.query.*)
// =============================================================================

export const cashiersRelations = relations(cashiers, ({ many }) => ({
  users: many(users),
  paymentMethods: many(paymentMethods),
  methodFields: many(methodFields),
  transactions: many(transactions),
  transactionFieldValues: many(transactionFieldValues),
  transactionUpdates: many(transactionUpdates),
  transactionAttachments: many(transactionAttachments),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  randomNames: many(randomNames),
  randomAddresses: many(randomAddresses),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  cashier: one(cashiers, {
    fields: [users.cashierId],
    references: [cashiers.id],
  }),
  transactions: many(transactions),
  transactionUpdates: many(transactionUpdates),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  createdMethods: many(paymentMethods),
}));

export const paymentMethodsRelations = relations(
  paymentMethods,
  ({ one, many }) => ({
    cashier: one(cashiers, {
      fields: [paymentMethods.cashierId],
      references: [cashiers.id],
    }),
    createdBy: one(users, {
      fields: [paymentMethods.createdByAdminId],
      references: [users.id],
    }),
    fields: many(methodFields),
    transactions: many(transactions),
  })
);

export const methodFieldsRelations = relations(methodFields, ({ one, many }) => ({
  cashier: one(cashiers, {
    fields: [methodFields.cashierId],
    references: [cashiers.id],
  }),
  method: one(paymentMethods, {
    fields: [methodFields.methodId],
    references: [paymentMethods.id],
  }),
  fieldValues: many(transactionFieldValues),
  attachments: many(transactionAttachments),
}));

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    cashier: one(cashiers, {
      fields: [transactions.cashierId],
      references: [cashiers.id],
    }),
    player: one(users, {
      fields: [transactions.playerId],
      references: [users.id],
    }),
    method: one(paymentMethods, {
      fields: [transactions.methodId],
      references: [paymentMethods.id],
    }),
    lockedByClerk: one(users, {
      fields: [transactions.lockedByClerkId],
      references: [users.id],
    }),
    fieldValues: many(transactionFieldValues),
    updates: many(transactionUpdates),
    attachments: many(transactionAttachments),
    notifications: many(notifications),
  })
);

export const transactionFieldValuesRelations = relations(
  transactionFieldValues,
  ({ one }) => ({
    cashier: one(cashiers, {
      fields: [transactionFieldValues.cashierId],
      references: [cashiers.id],
    }),
    transaction: one(transactions, {
      fields: [transactionFieldValues.transactionId],
      references: [transactions.id],
    }),
    methodField: one(methodFields, {
      fields: [transactionFieldValues.methodFieldId],
      references: [methodFields.id],
    }),
  })
);

export const transactionUpdatesRelations = relations(
  transactionUpdates,
  ({ one }) => ({
    cashier: one(cashiers, {
      fields: [transactionUpdates.cashierId],
      references: [cashiers.id],
    }),
    transaction: one(transactions, {
      fields: [transactionUpdates.transactionId],
      references: [transactions.id],
    }),
    updatedBy: one(users, {
      fields: [transactionUpdates.updatedByUserId],
      references: [users.id],
    }),
  })
);

export const transactionAttachmentsRelations = relations(
  transactionAttachments,
  ({ one }) => ({
    cashier: one(cashiers, {
      fields: [transactionAttachments.cashierId],
      references: [cashiers.id],
    }),
    transaction: one(transactions, {
      fields: [transactionAttachments.transactionId],
      references: [transactions.id],
    }),
    methodField: one(methodFields, {
      fields: [transactionAttachments.methodFieldId],
      references: [methodFields.id],
    }),
    uploadedBy: one(users, {
      fields: [transactionAttachments.uploadedByPlayerId],
      references: [users.id],
    }),
  })
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [auditLogs.cashierId],
    references: [cashiers.id],
  }),
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [notifications.cashierId],
    references: [cashiers.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  transaction: one(transactions, {
    fields: [notifications.transactionId],
    references: [transactions.id],
  }),
  transactionUpdate: one(transactionUpdates, {
    fields: [notifications.transactionUpdateId],
    references: [transactionUpdates.id],
  }),
}));

export const randomNamesRelations = relations(randomNames, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [randomNames.cashierId],
    references: [cashiers.id],
  }),
  lockedByTransaction: one(transactions, {
    fields: [randomNames.lockedByTransactionId],
    references: [transactions.id],
  }),
}));

export const randomAddressesRelations = relations(randomAddresses, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [randomAddresses.cashierId],
    references: [cashiers.id],
  }),
  lockedByTransaction: one(transactions, {
    fields: [randomAddresses.lockedByTransactionId],
    references: [transactions.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// Inferred TypeScript types for use across the app.
// =============================================================================

export type Cashier = typeof cashiers.$inferSelect;
export type NewCashier = typeof cashiers.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type MethodField = typeof methodFields.$inferSelect;
export type NewMethodField = typeof methodFields.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type TransactionFieldValue = typeof transactionFieldValues.$inferSelect;
export type NewTransactionFieldValue = typeof transactionFieldValues.$inferInsert;

export type TransactionUpdate = typeof transactionUpdates.$inferSelect;
export type NewTransactionUpdate = typeof transactionUpdates.$inferInsert;

export type TransactionAttachment = typeof transactionAttachments.$inferSelect;
export type NewTransactionAttachment = typeof transactionAttachments.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type RandomName = typeof randomNames.$inferSelect;
export type NewRandomName = typeof randomNames.$inferInsert;

export type RandomAddress = typeof randomAddresses.$inferSelect;
export type NewRandomAddress = typeof randomAddresses.$inferInsert;

export type MasterSession = typeof masterSessions.$inferSelect;
export type NewMasterSession = typeof masterSessions.$inferInsert;
