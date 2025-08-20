-- Create security function to get current organization ID from session
CREATE OR REPLACE FUNCTION current_organization_id() RETURNS text AS $$
BEGIN
  RETURN COALESCE(
    current_setting('app.organization_id', true),
    ''
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security function to get current user role  
CREATE OR REPLACE FUNCTION current_user_role() RETURNS text AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_role', true), 'anonymous');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create roles for different user types (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'accountant_role') THEN
    CREATE ROLE accountant_role;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'auditor_role') THEN
    CREATE ROLE auditor_role;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin_role') THEN
    CREATE ROLE admin_role;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'integration_bot_role') THEN
    CREATE ROLE integration_bot_role;
  END IF;
END
$$;