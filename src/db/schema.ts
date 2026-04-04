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
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",      // submitted by player, no clerk assigned
  "in_progress",  // clerk locked and is working on it
  "approved",     // clerk approved
  "rejected",     // clerk rejected
  "completed",    // fully processed and closed
  "cancelled",    // cancelled by player before processing
]);

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

    methodId: uuid("method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),

    label: text("label").notNull(),             // shown to the player, e.g. "Account Number"
    placeholder: text("placeholder"),           // input hint text
    fieldType: fieldTypeEnum("field_type").notNull(),
    isRequired: boolean("is_required").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0), // controls render order

    // Used when fieldType = "dropdown"
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
    index("method_fields_method_id_idx").on(table.methodId),
    index("method_fields_order_idx").on(table.methodId, table.displayOrder),
  ]
);

// =============================================================================
// TRANSACTIONS
// One row per deposit or payout request submitted by a Player.
// =============================================================================

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

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
    index("notif_user_id_idx").on(table.userId),
    index("notif_unread_idx").on(table.userId, table.isRead),
    index("notif_txn_id_idx").on(table.transactionId),
  ]
);

// =============================================================================
// RELATIONS
// Drizzle relation definitions — used by the query builder (db.query.*)
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  transactionUpdates: many(transactionUpdates),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  createdMethods: many(paymentMethods),
}));

export const paymentMethodsRelations = relations(
  paymentMethods,
  ({ one, many }) => ({
    createdBy: one(users, {
      fields: [paymentMethods.createdByAdminId],
      references: [users.id],
    }),
    fields: many(methodFields),
    transactions: many(transactions),
  })
);

export const methodFieldsRelations = relations(methodFields, ({ one, many }) => ({
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
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
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

// =============================================================================
// TYPE EXPORTS
// Inferred TypeScript types for use across the app.
// =============================================================================

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