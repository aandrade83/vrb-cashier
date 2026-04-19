ALTER TYPE "public"."field_type" ADD VALUE 'amount_list';--> statement-breakpoint
ALTER TYPE "public"."field_type" ADD VALUE 'hyperlink';--> statement-breakpoint
CREATE TABLE "cashiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"token" text NOT NULL,
	"logo_url" text,
	"client_url" text,
	"contact_email" text,
	"contact_phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cashiers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "cashiers_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "master_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "master_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "random_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cashier_id" uuid NOT NULL,
	"value" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "random_names" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cashier_id" uuid NOT NULL,
	"value" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "cashier_id" uuid;--> statement-breakpoint
ALTER TABLE "method_fields" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_field_values" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_updates" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "expected_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cashier_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "random_addresses" ADD CONSTRAINT "random_addresses_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_addresses" ADD CONSTRAINT "random_addresses_locked_by_transaction_id_transactions_id_fk" FOREIGN KEY ("locked_by_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_names" ADD CONSTRAINT "random_names_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "random_names" ADD CONSTRAINT "random_names_locked_by_transaction_id_transactions_id_fk" FOREIGN KEY ("locked_by_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cashiers_slug_idx" ON "cashiers" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "cashiers_token_idx" ON "cashiers" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "master_sessions_token_idx" ON "master_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "master_sessions_expires_at_idx" ON "master_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "random_addresses_cashier_id_idx" ON "random_addresses" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "random_addresses_priority_idx" ON "random_addresses" USING btree ("cashier_id","priority");--> statement-breakpoint
CREATE INDEX "random_addresses_locked_idx" ON "random_addresses" USING btree ("is_locked");--> statement-breakpoint
CREATE INDEX "random_names_cashier_id_idx" ON "random_names" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "random_names_priority_idx" ON "random_names" USING btree ("cashier_id","priority");--> statement-breakpoint
CREATE INDEX "random_names_locked_idx" ON "random_names" USING btree ("is_locked");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "method_fields" ADD CONSTRAINT "method_fields_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_field_values" ADD CONSTRAINT "transaction_field_values_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_updates" ADD CONSTRAINT "transaction_updates_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_cashier_id_cashiers_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."cashiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_cashier_id_idx" ON "audit_logs" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "method_fields_cashier_id_idx" ON "method_fields" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "notif_cashier_id_idx" ON "notifications" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "methods_cashier_id_idx" ON "payment_methods" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "attachments_cashier_id_idx" ON "transaction_attachments" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "txn_field_values_cashier_id_idx" ON "transaction_field_values" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "txn_updates_cashier_id_idx" ON "transaction_updates" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "txn_cashier_id_idx" ON "transactions" USING btree ("cashier_id");--> statement-breakpoint
CREATE INDEX "users_cashier_id_idx" ON "users" USING btree ("cashier_id");