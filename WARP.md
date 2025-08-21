# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Accounted App is an enterprise-grade, multi-tenant financial accounting system built with Next.js 15, React 19,
TypeScript, and PostgreSQL with Drizzle ORM. The system implements strict audit requirements, immutable journal entries
with cryptographic hash chaining, and comprehensive multi-currency support.

## Essential Development Commands

### Database Management

- `npm run db:up` - Start PostgreSQL container (port 6542)
- `npm run db:down` - Stop PostgreSQL container
- `npm run db:reset` - Reset database (removes all data)
- `npm run db:generate` - Generate migration files
- `npm run db:migrate` - Run pending migrations
- `npm run db:studio` - Open Drizzle Studio for database inspection

### Development Server

- `npm run dev` - Start development server on port 8888 with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Testing Scripts

- `tsx scripts/test-repositories.ts` - Test database repositories
- `tsx scripts/test-use-cases.ts` - Test business logic use cases

## Architecture Overview

### Core Domain Structure

The codebase follows Domain-Driven Design (DDD) principles:

**Domain Layer** (`src/domain/`):

- **Journal Aggregate**: Immutable accounting entries with hash chaining
- **Period Entity**: Accounting periods with open/closing/closed status
- **Value Objects**: Money (decimal precision), JournalHash (SHA-256), exchange rates
- **Services**: Posting service, hash service, business validation

**Application Layer** (`src/application/`):

- Use cases for journal operations (create, post, reverse, query)
- Use case factory for dependency injection
- Business orchestration and transaction boundaries

**Infrastructure Layer** (`src/db/`):

- PostgreSQL schema with Row-Level Security (RLS)
- Drizzle ORM configuration and connection management
- Database utilities and helpers

### Multi-Tenancy & Security Model

- **Row-Level Security (RLS)** enforced on all tables
- **Tenant Isolation** via session variables (`current_organization_id()`)
- **Role-based Access Control**:
    - `accountant`: Create/modify draft journals, reporting
    - `auditor`: Read-only access to journals and audit logs
    - `admin`: Technical administration, no cross-tenant access
    - `integration-bot`: API import/export with limited privileges

### Immutability & Hash Chaining

- Posted journals are immutable (changes only via reversal journals)
- Cryptographic hash chaining using SHA-256: `hash_self = SHA256(serialized_data + hash_prev)`
- Period-based posting restrictions (only `open` periods allow posting)

### Multi-Currency Support

- Each transaction stores: original currency, booking currency, exchange rate
- Decimal(18,4) precision with banker's rounding
- Monthly revaluation of open items using ECB rates

## Key Configuration Files

- **Database**: `drizzle.config.ts` - Connects to PostgreSQL on port 6542
- **Docker**: `docker-compose.yml` - PostgreSQL 18 with initialization scripts
- **Schema**: `src/db/schema.ts` - Complete database schema with RLS policies
- **Authentication**: Uses BetterAuth with organization-based multi-tenancy

## Critical Business Rules

### Journal Posting Rules

- Journals must be balanced (debits = credits)
- Line numbers must be sequential starting from 1
- Exchange rate calculations must be consistent
- Only draft journals can be modified
- Posted journals require reversal for corrections

### API Idempotency

- Mutating endpoints accept `Idempotency-Key` header
- Keys stored for 30 days in `idempotency_keys` table
- Duplicate requests with same key return identical response

### Audit & Compliance

- All mutations create audit log entries with request tracing
- 10-year data retention for UGB compliance
- GDPR DSAR process implementation required
- Signed audit logs for immutable tracking

## Development Guidelines

### Security Requirements

- All database queries must respect RLS policies
- API RPCs run under `SECURITY DEFINER` with least privilege
- AES-256 encryption at rest, TLS ≥ 1.2 in transit
- Never bypass tenant isolation checks

### Decimal Precision

- Use `decimal.js` library for all financial calculations
- Decimal(18,4) precision for amounts
- Decimal(18,6) precision for exchange rates
- Always use banker's rounding for consistency

### Error Handling

- Standard error format: `{ "code": "ERROR_CODE", "message": "Description" }`
- Domain error codes defined in `src/domain/shared/types.ts`
- Business rule violations return specific error codes

## Testing Strategy

### Repository Testing

Run `tsx scripts/test-repositories.ts` to test:

- Database connection and schema validation
- RLS policy enforcement
- CRUD operations with proper tenant isolation

### Use Case Testing

Run `tsx scripts/test-use-cases.ts` to test:

- Journal creation and validation
- Posting and immutability enforcement
- Business rule validation
- Hash chain integrity

## Database Schema Highlights

### Key Tables

- `journals` - Main accounting entries with hash chaining
- `journal_lines` - Individual debit/credit lines with multi-currency support
- `periods` - Accounting periods with posting restrictions
- `accounts` - Chart of accounts with multi-currency support
- `exchange_rates` - Historical exchange rates from ECB
- `audit_log` - Immutable audit trail for all operations

### BetterAuth Integration

- `user`, `session`, `organization`, `member` tables
- API key management for service authentication
- Two-factor authentication support

## Common Development Patterns

### Creating a Journal

```typescript
// Through use case
const createJournal = useCaseFactory.createJournal();
const result = await createJournal.execute({
  organizationId,
  periodId,
  journalNumber,
  description,
  lines: [/* journal lines */]
});
```

### Database Queries with RLS

```typescript
// RLS automatically enforced through session context
const journals = await db.select()
  .from(journalsTable)
  .where(eq(journalsTable.status, 'posted'));
// Only returns journals for current organization
```

### Money Calculations

```typescript
import { Money } from './domain/journal/value-objects/money';

const amount = Money.create('100.50', 'EUR');
const total = amount.add(Money.create('50.25', 'EUR'));
// Always use Money class for precision
```

## Performance Considerations

- Database connection pooling configured in `src/db/connection.ts`
- Indexes on organization_id, status, dates for optimal query performance
- Hash calculations cached for posted journals
- Use Drizzle Studio for query optimization and performance analysis

## Next Steps for New Features

1. Implement comprehensive test coverage (unit, integration, security)
2. Add API endpoints following OAuth 2.0 Client-Credentials Flow
3. Implement bank import functionality with deduplication
4. Build tax calculation engine with configurable rules
5. Create reporting endpoints for trial balance and financial statements
