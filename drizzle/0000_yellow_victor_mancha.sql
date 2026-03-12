CREATE TYPE "public"."field_type" AS ENUM('text', 'textarea', 'number', 'dropdown', 'file', 'image', 'date', 'checkbox');--> statement-breakpoint
CREATE TYPE "public"."method_type" AS ENUM('deposit', 'payout');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'in_progress', 'approved', 'rejected', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'clerk', 'player');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" "user_role",
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "method_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method_id" uuid NOT NULL,
	"label" text NOT NULL,
	"placeholder" text,
	"field_type" "field_type" NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"dropdown_options" jsonb,
	"file_config" jsonb,
	"validation_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid,
	"transaction_update_id" uuid,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivery_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "method_type" NOT NULL,
	"description" text,
	"logo_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_by_admin_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"method_field_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size_bytes" integer,
	"file_url" text NOT NULL,
	"uploaded_by_player_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"method_field_id" uuid NOT NULL,
	"field_label_snapshot" text NOT NULL,
	"field_type_snapshot" "field_type" NOT NULL,
	"value" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"updated_by_user_id" uuid NOT NULL,
	"previous_status" "transaction_status" NOT NULL,
	"new_status" "transaction_status" NOT NULL,
	"note_to_player" text,
	"internal_note" text,
	"email_sent_to_player" boolean DEFAULT false NOT NULL,
	"email_sent_at" timestamp with time zone,
	"email_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"type" "method_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"player_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"locked_by_clerk_id" uuid,
	"locked_at" timestamp with time zone,
	"lock_expires_at" timestamp with time zone,
	"internal_note" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_reference_code_unique" UNIQUE("reference_code"),
	CONSTRAINT "transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"role" "user_role" DEFAULT 'player' NOT NULL,
	"email" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_fields" ADD CONSTRAINT "method_fields_method_id_payment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."payment_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_transaction_update_id_transaction_updates_id_fk" FOREIGN KEY ("transaction_update_id") REFERENCES "public"."transaction_updates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_created_by_admin_id_users_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_method_field_id_method_fields_id_fk" FOREIGN KEY ("method_field_id") REFERENCES "public"."method_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_uploaded_by_player_id_users_id_fk" FOREIGN KEY ("uploaded_by_player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_field_values" ADD CONSTRAINT "transaction_field_values_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_field_values" ADD CONSTRAINT "transaction_field_values_method_field_id_method_fields_id_fk" FOREIGN KEY ("method_field_id") REFERENCES "public"."method_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_updates" ADD CONSTRAINT "transaction_updates_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_updates" ADD CONSTRAINT "transaction_updates_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_player_id_users_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_method_id_payment_methods_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."payment_methods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_locked_by_clerk_id_users_id_fk" FOREIGN KEY ("locked_by_clerk_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "method_fields_method_id_idx" ON "method_fields" USING btree ("method_id");--> statement-breakpoint
CREATE INDEX "method_fields_order_idx" ON "method_fields" USING btree ("method_id","display_order");--> statement-breakpoint
CREATE INDEX "notif_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notif_unread_idx" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "notif_txn_id_idx" ON "notifications" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "methods_type_idx" ON "payment_methods" USING btree ("type");--> statement-breakpoint
CREATE INDEX "methods_active_idx" ON "payment_methods" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "attachments_txn_id_idx" ON "transaction_attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "txn_field_values_txn_id_idx" ON "transaction_field_values" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "txn_field_values_field_id_idx" ON "transaction_field_values" USING btree ("method_field_id");--> statement-breakpoint
CREATE INDEX "txn_updates_txn_id_idx" ON "transaction_updates" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "txn_updates_user_id_idx" ON "transaction_updates" USING btree ("updated_by_user_id");--> statement-breakpoint
CREATE INDEX "txn_updates_created_at_idx" ON "transaction_updates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "txn_player_id_idx" ON "transactions" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "txn_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "txn_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "txn_locked_by_idx" ON "transactions" USING btree ("locked_by_clerk_id");--> statement-breakpoint
CREATE INDEX "txn_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "txn_reference_code_idx" ON "transactions" USING btree ("reference_code");--> statement-breakpoint
CREATE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");