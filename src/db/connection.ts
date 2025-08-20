import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:6542/accountanted';

// For migrations and other administrative tasks
export const migrationClient = postgres(connectionString, { max: 1 });

// For application queries with connection pooling
export const queryClient = postgres(connectionString, {
  max: 20,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

export const db = drizzle(queryClient, { schema });