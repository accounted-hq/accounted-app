# Accounted App - Enterprise Accounting System

This is a multi-tenant, enterprise-grade financial accounting system built with Next.js 15, React 19, TypeScript, and PostgreSQL with Drizzle ORM.

## Quick Start

1. **Start the database:**
   ```bash
   npm run db:up
   ```

2. **Run migrations:**
   ```bash
   npm run db:migrate
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Database Management

- `npm run db:up` - Start PostgreSQL container
- `npm run db:down` - Stop PostgreSQL container  
- `npm run db:reset` - Reset database (removes all data)
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run pending migrations
- `npm run db:studio` - Open Drizzle Studio

## Architecture

### Multi-tenancy & Security
- Row-Level Security (RLS) enforced on all tables
- Tenant isolation via session variables
- Role-based access control (accountant, auditor, admin, integration-bot)

### Core Features
- Immutable journal entries with cryptographic hash chaining
- Multi-currency support with automated revaluation
- Period-based posting restrictions
- Comprehensive audit logging
- API idempotency support

## Development

The project is structured in phases:
- **Phase 1**: Database setup, multi-tenancy, authentication
- **Phase 2**: Business logic, multi-currency, tax system
- **Phase 3**: Compliance, monitoring, backup systems

See `CLAUDE.md` for detailed implementation plan.

## Original Next.js Documentation

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.