CREATE TABLE "oauth_clients"
(
    "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" text                                       NOT NULL,
    "client_id"       varchar(255)                               NOT NULL,
    "client_secret"   varchar(255)                               NOT NULL,
    "name"            varchar(255)                               NOT NULL,
    "grants"          jsonb            DEFAULT '[
        "client_credentials"
    ]'                                                           NOT NULL,
    "scopes"          jsonb            DEFAULT '[
        "read",
        "write"
    ]'                                                           NOT NULL,
    "is_active"       boolean          DEFAULT true              NOT NULL,
    "created_at"      timestamp        DEFAULT now()             NOT NULL,
    "updated_at"      timestamp        DEFAULT now()             NOT NULL,
    "created_by"      text                                       NOT NULL,
    CONSTRAINT "oauth_clients_client_id_unique" UNIQUE ("client_id"),
    CONSTRAINT "oauth_clients_organization_id_name_unique" UNIQUE ("organization_id", "name")
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_tokens"
(
    "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "organization_id" text                                       NOT NULL,
    "client_id"       uuid                                       NOT NULL,
    "access_token"    varchar(255)                               NOT NULL,
    "refresh_token"   varchar(255),
    "scopes"          jsonb                                      NOT NULL,
    "expires_at"      timestamp                                  NOT NULL,
    "created_at"      timestamp        DEFAULT now()             NOT NULL,
    "last_used_at"    timestamp,
    "ip_address"      varchar(45),
    "user_agent"      text,
    CONSTRAINT "oauth_tokens_access_token_unique" UNIQUE ("access_token"),
    CONSTRAINT "oauth_tokens_refresh_token_unique" UNIQUE ("refresh_token")
);
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_clients"
    ADD CONSTRAINT "oauth_clients_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization" ("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients"
    ADD CONSTRAINT "oauth_clients_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user" ("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization" ("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens"
    ADD CONSTRAINT "oauth_tokens_client_id_oauth_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients" ("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_clients_organization_idx" ON "oauth_clients" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_client_id_idx" ON "oauth_clients" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_organization_idx" ON "oauth_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_client_idx" ON "oauth_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_tokens_access_token_idx" ON "oauth_tokens" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "oauth_tokens_expires_idx" ON "oauth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE
POLICY "oauth_clients_select_policy" ON "oauth_clients" AS PERMISSIVE FOR
SELECT TO "accountant_role", "admin_role", "auditor_role" USING ("oauth_clients"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_clients_insert_policy" ON "oauth_clients" AS PERMISSIVE FOR INSERT TO "admin_role" WITH CHECK ("oauth_clients"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_clients_update_policy" ON "oauth_clients" AS PERMISSIVE FOR
UPDATE TO "admin_role" USING ("oauth_clients"."organization_id" = current_organization_id())
WITH CHECK ("oauth_clients"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_clients_delete_policy" ON "oauth_clients" AS PERMISSIVE FOR DELETE
TO "admin_role" USING ("oauth_clients"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_tokens_select_policy" ON "oauth_tokens" AS PERMISSIVE FOR
SELECT TO "accountant_role", "admin_role", "auditor_role", "integration_bot_role" USING ("oauth_tokens"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_tokens_insert_policy" ON "oauth_tokens" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("oauth_tokens"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_tokens_update_policy" ON "oauth_tokens" AS PERMISSIVE FOR
UPDATE TO public USING ("oauth_tokens"."organization_id" = current_organization_id())
WITH CHECK ("oauth_tokens"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE
POLICY "oauth_tokens_delete_policy" ON "oauth_tokens" AS PERMISSIVE FOR DELETE
TO "admin_role" USING ("oauth_tokens"."organization_id" = current_organization_id());