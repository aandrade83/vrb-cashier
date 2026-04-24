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

export const userRoleEnum = pgEnum("user_role", ["admin", "clerk", "player"]);

export const masterRoleEnum = pgEnum("master_role", [
  "master_admin",
  "master_clerk",
]);

export const methodTypeEnum = pgEnum("method_type", ["deposit", "payout"]);

export const fieldTypeEnum = pgEnum("field_type", [
  "text", // single-line textbox
  "textarea", // multi-line textbox
  "number", // numeric input
  "dropdown", // select with predefined options
  "file", // file upload (PDF, DOC, etc.)
  "image", // image upload (JPG, PNG, etc.)
  "date", // date picker
  "checkbox", // boolean toggle
  "label", // static display text, no user input
  "hidden_label", // collapsible content block, toggle shows placeholder text
  "random_list", // shows a random value from dropdownOptions on each form load
  "amount_list", // buttons that set the amount field value
  "hyperlink", // clickable link opening in new tab
  "name", // auto-assigns a locked name from the names pool
  "address", // auto-assigns a locked address from the addresses pool
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "unassigned",   // Player submitted, no clerk assigned
  "pending",      // Clerk assigned and working on it
  "preconfirmed", // Clerk pre-confirmed — awaiting post-confirmation
  "postconfirmed",// Post-confirmed — awaiting master_admin completion
  "denied",       // Denied by clerk or admin
  "completed",    // Fully processed — terminal
  "cancelled",    // Cancelled by player — terminal
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

    name: text("name").notNull(), // e.g. "VRB Cashier"
    slug: text("slug").notNull().unique(), // 3-letter code, e.g. "vrb"
    token: text("token").notNull().unique(), // 7-char access token

    logoUrl: text("logo_url"),
    clientUrl: text("client_url"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),

    isActive: boolean("is_active").notNull().default(true),
    depositsEnabled: boolean("deposits_enabled").notNull().default(true),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cashiers_slug_idx").on(table.slug),
    uniqueIndex("cashiers_token_idx").on(table.token),
  ],
);

// =============================================================================
// USERS
// Internal auth — no Clerk dependency.
// Login identifier is `username` (unique per cashier, stored lowercase).
// Password is stored as a bcrypt hash.
// =============================================================================

export const cashierUsers = pgTable(
  "cashier_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    role: userRoleEnum("role").notNull().default("player"),

    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id),

    // Login identifier — unique within a cashier, always stored lowercase
    username: text("username").notNull(),

    // bcrypt hash of the user's password
    passwordHash: text("password_hash").notNull(),

    // Optional — players may not provide email immediately
    email: text("email"),

    // Email verification — required for players before accessing cashier features
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    verificationCode: text("verification_code"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    verificationLastSentAt: timestamp("verification_last_sent_at", { withTimezone: true }),

    firstName: text("first_name"),
    lastName: text("last_name"),
    avatarUrl: text("avatar_url"),

    isActive: boolean("is_active").notNull().default(true),

    mustResetPassword: boolean("must_reset_password").notNull().default(false),
    lastLogin: timestamp("last_login", { withTimezone: true }),

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
    index("cashier_users_cashier_id_idx").on(table.cashierId),
    index("cashier_users_role_idx").on(table.role),
    // username uniqueness is enforced per cashier, not globally
    uniqueIndex("cashier_users_username_cashier_idx").on(
      table.cashierId,
      table.username,
    ),
  ],
);

// =============================================================================
// MASTER USERS
// Internal auth for the /master/* routes.
// Only two roles: master_admin and master_clerk.
// The permanent ROOT account lives in ENV vars (MASTER_EMAIL / MASTER_PASSWORD)
// and is NOT stored here. Rows here are additional DB-managed accounts.
// =============================================================================

export const masterUsers = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    email: text("email").notNull().unique(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),

    // DB column is text — master_role enum is available for future migration
    role: text("role").$type<"master_admin" | "master_clerk">().notNull().default("master_clerk"),

    isActive: boolean("is_active").notNull().default(true),
    mustResetPassword: boolean("must_reset_password").notNull().default(false),
    lastLogin: timestamp("last_login", { withTimezone: true }),

    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    verificationCode: text("verification_code"),
    verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
    verificationAttempts: integer("verification_attempts").notNull().default(0),
    verificationLastSentAt: timestamp("verification_last_sent_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("master_users_email_idx").on(table.email),
    uniqueIndex("master_users_username_idx").on(table.username),
    index("master_users_role_idx").on(table.role),
    index("master_users_active_idx").on(table.isActive),
  ],
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

    // NULL = global method managed from master.
    // Non-null = legacy per-cashier method (retained for FK integrity on transactions).
    cashierId: uuid("cashier_id").references(() => cashiers.id),

    name: text("name").notNull(), // e.g. "Bank Transfer", "USDT TRC-20"
    type: methodTypeEnum("type").notNull(), // "deposit" | "payout"
    description: text("description"), // optional instructions shown to player
    logoUrl: text("logo_url"), // optional icon/logo for the method

    isActive: boolean("is_active").notNull().default(false), // Admin must explicitly activate

    // Soft-delete: deactivated methods remain visible in historical transactions
    isDeleted: boolean("is_deleted").notNull().default(false),

    // Minimum number of completed deposits a player must have before this method is available.
    // Default 1 means available immediately; higher values gate "trusted" methods.
    activateNumber: integer("activate_number").notNull().default(1),

    // NULL = created by master (no cashier admin context).
    createdByAdminId: uuid("created_by_admin_id").references(
      () => cashierUsers.id,
    ),

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
  ],
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

    // Denormalized cashierId — nullable for global methods (follows payment_methods.cashier_id).
    cashierId: uuid("cashier_id").references(() => cashiers.id),

    methodId: uuid("method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),

    label: text("label").notNull(), // shown to the player, e.g. "Account Number"
    placeholder: text("placeholder"), // input hint text
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
  ],
);

// =============================================================================
// TRANSACTIONS
// One row per deposit or payout request submitted by a Player.
//
// STATUS FLOW:
//   unassigned   → Player submitted, no clerk assigned (default)
//   pending      → Clerk assigned, actively working
//   preconfirmed → Clerk pre-confirmed
//   postconfirmed→ Post-confirmed; only master_admin can complete
//   completed    → Fully processed (terminal)
//   denied       → Denied by clerk/admin (terminal)
//   cancelled    → Cancelled by player (terminal)
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
    referenceCode: text("reference_code").notNull(),

    type: methodTypeEnum("type").notNull(), // "deposit" | "payout"

    status: transactionStatusEnum("status").notNull().default("unassigned"),

    // Player who submitted the transaction
    playerId: uuid("player_id")
      .notNull()
      .references(() => cashierUsers.id),

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
    lockedByClerkId: uuid("locked_by_clerk_id").references(
      () => cashierUsers.id,
    ),

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

    // -------------------------------------------------------------------------
    // WORKFLOW TIMESTAMPS — set when entering each status
    // -------------------------------------------------------------------------
    assignedAt:    timestamp("assigned_at",     { withTimezone: true }), // first clerk lock
    preconfirmedAt:timestamp("preconfirmed_at", { withTimezone: true }), // → preconfirmed
    postconfirmedAt:timestamp("postconfirmed_at",{ withTimezone: true }), // → postconfirmed
    completedAt:   timestamp("completed_at",    { withTimezone: true }), // → completed
    deniedAt:      timestamp("denied_at",       { withTimezone: true }), // → denied

    // Mandatory when status is denied
    deniedReason: text("denied_reason"),

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
    uniqueIndex("txn_reference_code_idx").on(table.cashierId, table.referenceCode),
  ],
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
  ],
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

    // Who made the change (clerk, admin, or null for master acting)
    updatedByUserId: uuid("updated_by_user_id")
      .references(() => cashierUsers.id),

    previousStatus: transactionStatusEnum("previous_status").notNull(),
    newStatus: transactionStatusEnum("new_status").notNull(),

    // Note visible to the player in their transaction history
    noteToPlayer: text("note_to_player"),

    // Internal note visible only to Admin and Clerk
    internalNote: text("internal_note"),

    // Email notification tracking
    emailSentToPlayer: boolean("email_sent_to_player").notNull().default(false),
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
  ],
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

    fileName: text("file_name").notNull(), // original filename
    fileType: text("file_type").notNull(), // MIME type, e.g. "image/png"
    fileSizeBytes: integer("file_size_bytes"),
    fileUrl: text("file_url").notNull(), // URL in Vercel Blob / S3 / Cloudinary

    uploadedByPlayerId: uuid("uploaded_by_player_id")
      .notNull()
      .references(() => cashierUsers.id),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("attachments_cashier_id_idx").on(table.cashierId),
    index("attachments_txn_id_idx").on(table.transactionId),
  ],
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

    cashierId: uuid("cashier_id").references(() => cashiers.id),

    // Who performed the action — null for system/webhook actions
    actorUserId: uuid("actor_user_id").references(() => cashierUsers.id),
    actorRole: userRoleEnum("actor_role"),

    // What happened, e.g. "transaction.status_changed", "method.created", "user.login"
    action: text("action").notNull(),

    // Which entity was affected
    entityType: text("entity_type"), // "transaction" | "method" | "user" | "method_field"
    entityId: uuid("entity_id"), // ID of the affected row

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
  ],
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
      .references(() => cashierUsers.id, { onDelete: "cascade" }),

    // Source event that triggered the notification
    transactionId: uuid("transaction_id").references(() => transactions.id),
    transactionUpdateId: uuid("transaction_update_id").references(
      () => transactionUpdates.id,
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
  ],
);

// =============================================================================
// RANDOM NAMES
// Pool of names assigned to transactions for anonymization per cashier.
// Lowest priority number = highest priority for assignment.
// =============================================================================

export const names = pgTable(
  "names",
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
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("names_cashier_id_idx").on(table.cashierId),
    index("names_priority_idx").on(table.cashierId, table.priority),
    index("names_locked_idx").on(table.isLocked),
  ],
);

// =============================================================================
// RANDOM ADDRESSES
// Pool of addresses assigned to transactions per cashier.
// Same lock logic as names.
// =============================================================================

export const addresses = pgTable(
  "addresses",
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
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("addresses_cashier_id_idx").on(table.cashierId),
    index("addresses_priority_idx").on(table.cashierId, table.priority),
    index("addresses_locked_idx").on(table.isLocked),
  ],
);

// =============================================================================
// CASHIER METHODS (Junction)
// Links global payment methods to specific cashiers.
// A method is available to a cashier only if a row exists here with enabled=true.
// =============================================================================

export const cashierMethods = pgTable(
  "cashier_methods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id, { onDelete: "cascade" }),
    methodId: uuid("method_id")
      .notNull()
      .references(() => paymentMethods.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cashier_methods_cashier_method_idx").on(
      table.cashierId,
      table.methodId,
    ),
    index("cashier_methods_cashier_id_idx").on(table.cashierId),
    index("cashier_methods_method_id_idx").on(table.methodId),
  ],
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

    // NULL = ENV root session. Non-null = DB user session.
    masterUserId: uuid("master_user_id").references(() => masterUsers.id, {
      onDelete: "set null",
    }),

    // 'env' = logged in via MASTER_EMAIL/MASTER_PASSWORD env vars
    // 'db'  = logged in via users table
    loginSource: text("login_source").notNull().default("env"),

    // Set when master is acting inside a specific cashier tenant
    actingCashierId: uuid("acting_cashier_id").references(() => cashiers.id, {
      onDelete: "set null",
    }),

    // Role to impersonate when visiting cashier: null = admin, 'clerk', 'player'
    actingRole: text("acting_role"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("master_sessions_token_idx").on(table.token),
    index("master_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

// =============================================================================
// USER SESSIONS
// Authenticated sessions for player/clerk/admin users (internal auth, no Clerk).
// =============================================================================

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => cashierUsers.id, { onDelete: "cascade" }),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id, { onDelete: "cascade" }),
    role: userRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("user_sessions_token_idx").on(table.token),
    index("user_sessions_user_id_idx").on(table.userId),
    index("user_sessions_cashier_id_idx").on(table.cashierId),
    index("user_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

// =============================================================================
// LOGIN ATTEMPTS
// Audit log + rate limiting source for all login events.
// =============================================================================

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cashierId: uuid("cashier_id").references(() => cashiers.id, {
      onDelete: "cascade",
    }),
    username: text("username").notNull(),
    ipAddress: text("ip_address"),
    success: boolean("success").notNull(),
    // null | 'wrong_password' | 'sportsbook_invalid' | 'sportsbook_error' | 'user_inactive'
    failureReason: text("failure_reason"),
    sportsbookChecked: boolean("sportsbook_checked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("login_attempts_lookup_idx").on(
      table.cashierId,
      table.username,
      table.createdAt,
    ),
  ],
);

// =============================================================================
// USER CASHIER PERMISSIONS
// Controls which cashiers a DB master user (master_admin/master_clerk) can access.
// ENV root always has access to everything — no row needed.
// =============================================================================

export const userCashierPermissions = pgTable(
  "user_cashier_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    masterUserId: uuid("master_user_id")
      .notNull()
      .references(() => masterUsers.id, { onDelete: "cascade" }),
    cashierId: uuid("cashier_id")
      .notNull()
      .references(() => cashiers.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ucp_user_cashier_idx").on(table.masterUserId, table.cashierId),
    index("ucp_user_id_idx").on(table.masterUserId),
    index("ucp_cashier_id_idx").on(table.cashierId),
  ],
);

// =============================================================================
// RELATIONS
// Drizzle relation definitions — used by the query builder (db.query.*)
// =============================================================================

export const masterUsersRelations = relations(masterUsers, ({ many }) => ({
  sessions: many(masterSessions),
  cashierPermissions: many(userCashierPermissions),
}));

export const cashiersRelations = relations(cashiers, ({ many }) => ({
  cashierUsers: many(cashierUsers),
  paymentMethods: many(paymentMethods),
  cashierMethods: many(cashierMethods),
  methodFields: many(methodFields),
  transactions: many(transactions),
  transactionFieldValues: many(transactionFieldValues),
  transactionUpdates: many(transactionUpdates),
  transactionAttachments: many(transactionAttachments),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  names: many(names),
  addresses: many(addresses),
}));

export const cashierUsersRelations = relations(
  cashierUsers,
  ({ one, many }) => ({
    cashier: one(cashiers, {
      fields: [cashierUsers.cashierId],
      references: [cashiers.id],
    }),
    transactions: many(transactions),
    transactionUpdates: many(transactionUpdates),
    auditLogs: many(auditLogs),
    notifications: many(notifications),
    createdMethods: many(paymentMethods),
  }),
);

export const paymentMethodsRelations = relations(
  paymentMethods,
  ({ one, many }) => ({
    cashier: one(cashiers, {
      fields: [paymentMethods.cashierId],
      references: [cashiers.id],
    }),
    createdBy: one(cashierUsers, {
      fields: [paymentMethods.createdByAdminId],
      references: [cashierUsers.id],
    }),
    fields: many(methodFields),
    transactions: many(transactions),
    cashierAssignments: many(cashierMethods),
  }),
);

export const cashierMethodsRelations = relations(cashierMethods, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [cashierMethods.cashierId],
    references: [cashiers.id],
  }),
  method: one(paymentMethods, {
    fields: [cashierMethods.methodId],
    references: [paymentMethods.id],
  }),
}));

export const methodFieldsRelations = relations(
  methodFields,
  ({ one, many }) => ({
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
  }),
);

export const transactionsRelations = relations(
  transactions,
  ({ one, many }) => ({
    cashier: one(cashiers, {
      fields: [transactions.cashierId],
      references: [cashiers.id],
    }),
    player: one(cashierUsers, {
      fields: [transactions.playerId],
      references: [cashierUsers.id],
    }),
    method: one(paymentMethods, {
      fields: [transactions.methodId],
      references: [paymentMethods.id],
    }),
    lockedByClerk: one(cashierUsers, {
      fields: [transactions.lockedByClerkId],
      references: [cashierUsers.id],
    }),
    fieldValues: many(transactionFieldValues),
    updates: many(transactionUpdates),
    attachments: many(transactionAttachments),
    notifications: many(notifications),
  }),
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
  }),
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
    updatedBy: one(cashierUsers, {
      fields: [transactionUpdates.updatedByUserId],
      references: [cashierUsers.id],
    }),
  }),
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
    uploadedBy: one(cashierUsers, {
      fields: [transactionAttachments.uploadedByPlayerId],
      references: [cashierUsers.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [auditLogs.cashierId],
    references: [cashiers.id],
  }),
  actor: one(cashierUsers, {
    fields: [auditLogs.actorUserId],
    references: [cashierUsers.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [notifications.cashierId],
    references: [cashiers.id],
  }),
  user: one(cashierUsers, {
    fields: [notifications.userId],
    references: [cashierUsers.id],
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

export const namesRelations = relations(names, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [names.cashierId],
    references: [cashiers.id],
  }),
  lockedByTransaction: one(transactions, {
    fields: [names.lockedByTransactionId],
    references: [transactions.id],
  }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [addresses.cashierId],
    references: [cashiers.id],
  }),
  lockedByTransaction: one(transactions, {
    fields: [addresses.lockedByTransactionId],
    references: [transactions.id],
  }),
}));

// =============================================================================
// TYPE EXPORTS
// Inferred TypeScript types for use across the app.
// =============================================================================

export type Cashier = typeof cashiers.$inferSelect;
export type NewCashier = typeof cashiers.$inferInsert;

export type MasterUser = typeof masterUsers.$inferSelect;
export type NewMasterUser = typeof masterUsers.$inferInsert;

export type CashierUser = typeof cashierUsers.$inferSelect;
export type NewCashierUser = typeof cashierUsers.$inferInsert;

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;

export type CashierMethod = typeof cashierMethods.$inferSelect;
export type NewCashierMethod = typeof cashierMethods.$inferInsert;

export type UserCashierPermission = typeof userCashierPermissions.$inferSelect;
export type NewUserCashierPermission = typeof userCashierPermissions.$inferInsert;

export type MethodField = typeof methodFields.$inferSelect;
export type NewMethodField = typeof methodFields.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type TransactionFieldValue = typeof transactionFieldValues.$inferSelect;
export type NewTransactionFieldValue =
  typeof transactionFieldValues.$inferInsert;

export type TransactionUpdate = typeof transactionUpdates.$inferSelect;
export type NewTransactionUpdate = typeof transactionUpdates.$inferInsert;

export type TransactionAttachment = typeof transactionAttachments.$inferSelect;
export type NewTransactionAttachment =
  typeof transactionAttachments.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type Name = typeof names.$inferSelect;
export type NewName = typeof names.$inferInsert;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type MasterSession = typeof masterSessions.$inferSelect;
export type NewMasterSession = typeof masterSessions.$inferInsert;
