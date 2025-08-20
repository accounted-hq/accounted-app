# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an accounting system (accountanted) built with Next.js 15.4.6, React 19, and TypeScript. The project implements a multi-tenant, enterprise-grade financial accounting system with strict audit requirements and immutable journal entries.

## Development Commands

- **Development server**: `npm run dev` (uses Turbopack for fast rebuilds)
- **Production build**: `npm run build`
- **Start production**: `npm start`
- **Linting**: `npm run lint`

## Architecture

### Framework Stack
- **Frontend**: Next.js 15 with App Router
- **Styling**: TailwindCSS v4 with PostCSS
- **Fonts**: Geist and Geist Mono via next/font/google
- **TypeScript**: Strict mode enabled with ES2017 target

### Key Requirements from REQUIREMENTS.md

**Multi-tenancy & Security**
- All data must be tenant-specific with Row-Level Security (RLS)
- Role-based access: `accountant`, `auditor`, `admin`, `integration-bot`
- API RPCs run under `SECURITY DEFINER` with least privilege
- AES-256 encryption at rest, TLS ≥ 1.2 in transit

**Journal Immutability**
- Posted journals are immutable (changes only via reversal journals)
- Cryptographic hash chaining (`hash_prev`, `hash_self = SHA256(serialized_data + hash_prev)`)
- Period-based posting restrictions (only `open` periods)

**Multi-currency Support**
- Each transaction stores: original currency, booking currency, exchange rate
- Monthly revaluation of open items using ECB rates
- Decimal(18,4) precision with banker's rounding

**API Design**
- Base URL: `/api`
- OAuth 2.0 with Client-Credentials Flow
- Idempotency via `Idempotency-Key` header (30-day retention)
- Standard error format: `{ "code": "ERROR_CODE", "message": "Description" }`

**Compliance & Audit**
- 10-year data retention (UGB compliance)
- Immutable audit logs for all mutations
- GDPR DSAR process implementation required

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with fonts
│   ├── page.tsx           # Home page (default Next.js)
│   └── globals.css        # Global styles
```

## TypeScript Configuration

- Path alias: `@/*` maps to `./src/*`
- Strict mode enabled
- Next.js plugin integrated for optimal type checking

## Implementation Plan

### Phase 1: Foundation (High Priority)
1. **Database Setup & Multi-tenancy**
   - Set up PostgreSQL with RLS policies
   - Create tenant isolation schema
   - Implement database connection pooling

2. **Authentication & Authorization**
   - OAuth 2.0 Client-Credentials Flow
   - Role-based permissions (accountant, auditor, admin, integration-bot)
   - JWT token validation middleware

3. **Core Journal System**
   - Immutable journal entries with hash chaining
   - Period management (open/closing/closed status)
   - Posting validation and restrictions

### Phase 2: Business Logic (Medium Priority)
4. **Multi-currency Support**
   - Exchange rate management
   - Monthly revaluation process
   - Decimal precision handling (18,4)

5. **Tax System**
   - Configurable tax rules per tenant
   - Tax position tracking
   - Export functionality for tax reports

6. **API Infrastructure**
   - Idempotency key handling (30-day retention)
   - Standard error response format
   - Core API endpoints implementation

7. **Bank Import & Deduplication**
   - File import processing
   - Duplicate detection via ext_uid/hash
   - Automated journal creation

### Phase 3: Compliance & Operations (Lower Priority)
8. **Audit & Logging**
   - Comprehensive mutation tracking
   - Signed audit logs with 10-year retention
   - Request correlation and tracing

9. **Compliance Features**
   - GDPR DSAR process implementation
   - Data retention policies
   - Automated archiving/deletion

10. **Monitoring & Backup**
    - Performance metrics and alerting
    - PITR backup strategy
    - Health checks and SLA monitoring

### Current Status
- ✅ Initial Next.js project setup
- 🔄 Ready to begin Phase 1 implementation
- 📋 All requirements documented and planned

### Test Coverage Requirements
Each feature must include:
- Unit tests for business logic
- Integration tests for API endpoints
- Security tests for RLS and permissions
- Performance tests for SLA compliance

## Important Notes

- This is currently a fresh Next.js project that needs to be developed into the accounting system
- The REQUIREMENTS.md contains detailed German specifications for enterprise accounting features
- Focus on security, immutability, and audit trails when implementing features
- All financial calculations must use precise decimal arithmetic
- Multi-tenant architecture is critical for the entire system