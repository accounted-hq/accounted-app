ALTER TABLE "journals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journals" DROP CONSTRAINT "journals_reversal_journal_id_journals_id_fk";
--> statement-breakpoint
ALTER TABLE "journals" DROP CONSTRAINT "journals_original_journal_id_journals_id_fk";
--> statement-breakpoint
CREATE POLICY "journals_org_policy" ON "journals" AS PERMISSIVE FOR ALL TO "accountant_role", "admin_role", "auditor_role", "integration_bot_role" USING ("journals"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE POLICY "journals_write_policy" ON "journals" AS PERMISSIVE FOR INSERT TO "accountant_role", "admin_role", "integration_bot_role" WITH CHECK ("journals"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE POLICY "journals_update_policy" ON "journals" AS PERMISSIVE FOR UPDATE TO "accountant_role", "admin_role" USING ("journals"."organization_id" = current_organization_id() AND "journals"."status" = 'draft') WITH CHECK ("journals"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE POLICY "periods_org_policy" ON "periods" AS PERMISSIVE FOR ALL TO "accountant_role", "admin_role", "auditor_role", "integration_bot_role" USING ("periods"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE POLICY "periods_write_policy" ON "periods" AS PERMISSIVE FOR INSERT TO "accountant_role", "admin_role" WITH CHECK ("periods"."organization_id" = current_organization_id());--> statement-breakpoint
CREATE POLICY "periods_update_policy" ON "periods" AS PERMISSIVE FOR UPDATE TO "accountant_role", "admin_role" USING ("periods"."organization_id" = current_organization_id()) WITH CHECK ("periods"."organization_id" = current_organization_id());