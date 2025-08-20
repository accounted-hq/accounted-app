import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    host: 'localhost',
    port: 6542,
    user: 'postgres',
    password: 'postgres',
    database: 'accountanted',
  },
});