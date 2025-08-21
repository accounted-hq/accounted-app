ALTER
POLICY "oauth_tokens_delete_policy" ON "oauth_tokens" TO public USING ("oauth_tokens"."organization_id" = current_organization_id());