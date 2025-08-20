import { db, queryClient } from './connection';
import { sql } from 'drizzle-orm';

export interface OrganizationContext {
  organizationId: string;
  userId?: string;
  userRole?: 'accountant' | 'auditor' | 'admin' | 'integration-bot';
}

/**
 * Execute a database operation with organization context
 * This sets the session variables for RLS policies
 */
export async function withOrganizationContext<T>(
  context: OrganizationContext,
  operation: () => Promise<T>
): Promise<T> {
  // Set session variables for RLS
  await db.execute(sql`SELECT set_config('app.organization_id', ${context.organizationId}, true)`);
  
  if (context.userId) {
    await db.execute(sql`SELECT set_config('app.user_id', ${context.userId}, true)`);
  }
  
  if (context.userRole) {
    await db.execute(sql`SELECT set_config('app.user_role', ${context.userRole}, true)`);
  }

  try {
    return await operation();
  } finally {
    // Clear session variables
    await db.execute(sql`SELECT set_config('app.organization_id', '', true)`);
    await db.execute(sql`SELECT set_config('app.user_id', '', true)`);
    await db.execute(sql`SELECT set_config('app.user_role', '', true)`);
  }
}

/**
 * Execute raw SQL with proper error handling
 */
export async function executeSql(query: string, params?: any[]) {
  try {
    return await queryClient.unsafe(query, params);
  } catch (error) {
    console.error('SQL execution error:', error);
    throw error;
  }
}

/**
 * Test RLS policies by attempting cross-organization access
 */
export async function testRlsPolicies(organizationId1: string, organizationId2: string) {
  // This should return 0 rows when querying org2 data with org1 context
  const result = await withOrganizationContext(
    { organizationId: organizationId1 },
    () => db.execute(sql`SELECT COUNT(*) FROM periods WHERE organization_id = ${organizationId2}`)
  );
  
  return result;
}