import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  integer,
  boolean,
  jsonb,
  unique,
  index,
  pgPolicy,
  pgRole,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// SECURITY ROLES AND FUNCTIONS
// ============================================================================

// Define database roles for different user types
export const accountantRole = pgRole('accountant_role').existing();
export const auditorRole = pgRole('auditor_role').existing();
export const adminRole = pgRole('admin_role').existing();
export const integrationBotRole = pgRole('integration_bot_role').existing();

// Security functions for RLS (defined in init script)
export const currentOrganizationId = sql`current_organization_id()`;
export const currentUserRole = sql`current_user_role()`;

// Note: tenants table removed - BetterAuth's organization table handles multi-tenancy
// Note: users table removed - BetterAuth's user + member tables handle user management

// Accounting periods
export const periods = pgTable('periods', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('open'), // open, closing, closed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Indexes
  index('periods_organization_idx').on(table.organizationId),
  index('periods_status_idx').on(table.status),
  
  // RLS Policies
  pgPolicy('periods_org_policy', {
    for: 'all',
    to: [accountantRole, adminRole, auditorRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  // Restrict write operations to accountants and admins only
  pgPolicy('periods_write_policy', {
    for: 'insert',
    to: [accountantRole, adminRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('periods_update_policy', {
    for: 'update', 
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
]);

// Chart of accounts
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // asset, liability, equity, revenue, expense
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.code),
  index('accounts_organization_idx').on(table.organizationId),
  index('accounts_type_idx').on(table.type),
  
  // RLS policies
  pgPolicy('accounts_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('accounts_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('accounts_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('accounts_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// Exchange rates
export const exchangeRates = pgTable('exchange_rates', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
  toCurrency: varchar('to_currency', { length: 3 }).notNull(),
  rate: decimal('rate', { precision: 18, scale: 6 }).notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  source: varchar('source', { length: 50 }).notNull().default('ECB'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.fromCurrency, table.toCurrency, table.effectiveDate),
  index('exchange_rates_organization_idx').on(table.organizationId),
  index('exchange_rates_date_idx').on(table.effectiveDate),
  
  // RLS policies
  pgPolicy('exchange_rates_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('exchange_rates_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('exchange_rates_update_policy', {
    for: 'update',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('exchange_rates_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// Journal entries - immutable once posted
export const journals = pgTable('journals', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  periodId: uuid('period_id').references(() => periods.id).notNull(),
  journalNumber: varchar('journal_number', { length: 50 }).notNull(),
  description: text('description').notNull(),
  reference: varchar('reference', { length: 255 }),
  postingDate: timestamp('posting_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, posted, reversed
  totalDebit: decimal('total_debit', { precision: 18, scale: 4 }).notNull(),
  totalCredit: decimal('total_credit', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  // Hash chaining for immutability
  hashPrev: varchar('hash_prev', { length: 64 }),
  hashSelf: varchar('hash_self', { length: 64 }),
  // Reversal tracking (will add foreign keys in a separate migration)
  reversalJournalId: uuid('reversal_journal_id'),
  originalJournalId: uuid('original_journal_id'),
  // External system integration
  extUid: varchar('ext_uid', { length: 255 }), // External system unique ID
  // Audit fields
  createdBy: text('created_by').references(() => user.id).notNull(),
  postedBy: text('posted_by').references(() => user.id),
  postedAt: timestamp('posted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Constraints and indexes
  unique().on(table.organizationId, table.journalNumber),
  unique().on(table.organizationId, table.extUid),
  index('journals_organization_idx').on(table.organizationId),
  index('journals_period_idx').on(table.periodId),
  index('journals_status_idx').on(table.status),
  index('journals_date_idx').on(table.postingDate),
  
  // RLS Policies - organization isolation
  pgPolicy('journals_org_policy', {
    for: 'all',
    to: [accountantRole, adminRole, auditorRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  // Write policies - only accountants, admins, and integration bots can create/modify
  pgPolicy('journals_write_policy', {
    for: 'insert', 
    to: [accountantRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  // Update only allowed for draft journals by accountants/admins
  pgPolicy('journals_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId} AND ${table.status} = 'draft'`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
]);

// Journal line items
export const journalLines = pgTable('journal_lines', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  journalId: uuid('journal_id').references(() => journals.id).notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(),
  lineNumber: integer('line_number').notNull(),
  description: text('description').notNull(),
  debitAmount: decimal('debit_amount', { precision: 18, scale: 4 }).default('0'),
  creditAmount: decimal('credit_amount', { precision: 18, scale: 4 }).default('0'),
  // Multi-currency support
  originalCurrency: varchar('original_currency', { length: 3 }).notNull(),
  originalDebitAmount: decimal('original_debit_amount', { precision: 18, scale: 4 }).default('0'),
  originalCreditAmount: decimal('original_credit_amount', { precision: 18, scale: 4 }).default('0'),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 6 }).notNull().default('1'),
  // Tax information
  taxCode: varchar('tax_code', { length: 20 }),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 4 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 4 }).default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.journalId, table.lineNumber),
  index('journal_lines_organization_idx').on(table.organizationId),
  index('journal_lines_journal_idx').on(table.journalId),
  index('journal_lines_account_idx').on(table.accountId),
  
  // RLS policies
  pgPolicy('journal_lines_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('journal_lines_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('journal_lines_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId} AND EXISTS (
      SELECT 1 FROM journals j WHERE j.id = ${table.journalId} AND j.status = 'draft'
    )`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('journal_lines_delete_policy', {
    for: 'delete',
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId} AND EXISTS (
      SELECT 1 FROM journals j WHERE j.id = ${table.journalId} AND j.status = 'draft'
    )`,
  })
]).enableRLS();

// Idempotency keys for API requests
export const idempotencyKeys = pgTable('idempotency_keys', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseData: jsonb('response_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.key),
  index('idempotency_keys_organization_idx').on(table.organizationId),
  index('idempotency_expires_idx').on(table.expiresAt),
  
  // RLS policies
  pgPolicy('idempotency_keys_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('idempotency_keys_insert_policy', {
    for: 'insert',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('idempotency_keys_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId} AND ${table.expiresAt} < NOW()`,
  })
]).enableRLS();

// Audit log for all mutations
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  userId: text('user_id').references(() => user.id),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(), // CREATE, UPDATE, DELETE
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  requestId: varchar('request_id', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  signature: varchar('signature', { length: 128 }), // For immutable logs
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  index('audit_log_organization_idx').on(table.organizationId),
  index('audit_entity_idx').on(table.entityType, table.entityId),
  index('audit_date_idx').on(table.createdAt),
  
  // RLS policies
  pgPolicy('audit_log_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('audit_log_insert_policy', {
    for: 'insert',
    to: 'public',
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('audit_log_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// Tax configuration for tenant-specific tax rules
export const taxConfigs = pgTable('tax_configs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  rate: decimal('rate', { precision: 5, scale: 4 }).notNull(), // e.g., 0.1900 for 19%
  country: varchar('country', { length: 3 }).notNull(), // ISO 3166-1 alpha-3
  region: varchar('region', { length: 10 }), // State/Province for regional taxes
  validFrom: timestamp('valid_from').notNull(),
  validTo: timestamp('valid_to'), // null means currently valid
  accountId: uuid('account_id').references(() => accounts.id).notNull(), // Tax liability account
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.code),
  index('tax_configs_organization_idx').on(table.organizationId),
  index('tax_configs_country_idx').on(table.country),
  index('tax_configs_validity_idx').on(table.validFrom, table.validTo),
  
  // RLS policies
  pgPolicy('tax_configs_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('tax_configs_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('tax_configs_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('tax_configs_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// Bank import tracking for deduplication
export const bankImports = pgTable('bank_imports', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileHash: varchar('file_hash', { length: 64 }).notNull(), // SHA-256 of file content
  fileSize: integer('file_size').notNull(),
  accountId: uuid('account_id').references(() => accounts.id).notNull(), // Bank account
  importedBy: text('imported_by').references(() => user.id).notNull(),
  recordsTotal: integer('records_total').notNull(),
  recordsImported: integer('records_imported').notNull(),
  recordsSkipped: integer('records_skipped').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('processing'), // processing, completed, failed
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').default('{}'), // Additional import metadata
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.fileHash),
  index('bank_imports_organization_idx').on(table.organizationId),
  index('bank_imports_status_idx').on(table.status),
  index('bank_imports_date_idx').on(table.createdAt),
  
  // RLS policies
  pgPolicy('bank_imports_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_imports_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_imports_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_imports_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// Bank import details for individual transactions
export const bankImportDetails = pgTable('bank_import_details', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organization.id).notNull(),
  importId: uuid('import_id').references(() => bankImports.id).notNull(),
  extUid: varchar('ext_uid', { length: 255 }).notNull(), // External system unique ID
  transactionDate: timestamp('transaction_date').notNull(),
  amount: decimal('amount', { precision: 18, scale: 4 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  description: text('description').notNull(),
  reference: varchar('reference', { length: 255 }),
  counterparty: varchar('counterparty', { length: 255 }),
  journalId: uuid('journal_id').references(() => journals.id), // null if not yet journalized
  status: varchar('status', { length: 20 }).notNull().default('imported'), // imported, journalized, ignored
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // Indexes and constraints
  unique().on(table.organizationId, table.extUid),
  index('bank_import_details_organization_idx').on(table.organizationId),
  index('bank_import_details_import_idx').on(table.importId),
  index('bank_import_details_journal_idx').on(table.journalId),
  index('bank_import_details_status_idx').on(table.status),
  
  // RLS policies
  pgPolicy('bank_import_details_select_policy', {
    for: 'select',
    to: [accountantRole, auditorRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_import_details_insert_policy', {
    for: 'insert',
    to: [accountantRole, adminRole, integrationBotRole],
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_import_details_update_policy', {
    for: 'update',
    to: [accountantRole, adminRole, integrationBotRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
    withCheck: sql`${table.organizationId} = ${currentOrganizationId}`,
  }),
  
  pgPolicy('bank_import_details_delete_policy', {
    for: 'delete',
    to: [adminRole],
    using: sql`${table.organizationId} = ${currentOrganizationId}`,
  })
]).enableRLS();

// ============================================================================
// BETTER AUTH TABLES
// ============================================================================
// Note: These tables are required by BetterAuth for authentication functionality

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').$defaultFn(() => false).notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()).notNull(),
  twoFactorEnabled: boolean('two_factor_enabled'),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  activeOrganizationId: text('active_organization_id'),
  impersonatedBy: text('impersonated_by'),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').$defaultFn(() => new Date()),
  updatedAt: timestamp('updated_at').$defaultFn(() => new Date()),
});

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull(),
  metadata: text('metadata'),
});

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const apikey = pgTable('apikey', {
  id: text('id').primaryKey(),
  name: text('name'),
  start: text('start'),
  prefix: text('prefix'),
  key: text('key').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  refillInterval: integer('refill_interval'),
  refillAmount: integer('refill_amount'),
  lastRefillAt: timestamp('last_refill_at'),
  enabled: boolean('enabled').default(true),
  rateLimitEnabled: boolean('rate_limit_enabled').default(true),
  rateLimitTimeWindow: integer('rate_limit_time_window').default(86400000),
  rateLimitMax: integer('rate_limit_max').default(10),
  requestCount: integer('request_count'),
  remaining: integer('remaining'),
  lastRequest: timestamp('last_request'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  permissions: text('permissions'),
  metadata: text('metadata'),
});

export const twoFactor = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// ============================================================================
// OAUTH 2.0 TABLES
// ============================================================================

// OAuth clients for service-to-service authentication
export const oauthClients = pgTable('oauth_clients', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid
    ()`),
    organizationId: text('organization_id').references(() => organization.id).notNull(),
    clientId: varchar('client_id', {length: 255}).unique().notNull(),
    clientSecret: varchar('client_secret', {length: 255}).notNull(), // bcrypt hashed
    name: varchar('name', {length: 255}).notNull(),
    grants: jsonb('grants').default(JSON.stringify(['client_credentials'])).notNull(),
    scopes: jsonb('scopes').default(JSON.stringify(['read', 'write'])).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: text('created_by').references(() => user.id).notNull(),
}, (table) => [
    // Indexes and constraints
    unique().on(table.organizationId, table.name),
    index('oauth_clients_organization_idx').on(table.organizationId),
    index('oauth_clients_client_id_idx').on(table.clientId),

    // RLS policies
    pgPolicy('oauth_clients_select_policy', {
        for: 'select',
        to: [accountantRole, auditorRole, adminRole],
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_clients_insert_policy', {
        for: 'insert',
        to: [adminRole],
        withCheck: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_clients_update_policy', {
        for: 'update',
        to: [adminRole],
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
        withCheck: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_clients_delete_policy', {
        for: 'delete',
        to: [adminRole],
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    })
]).enableRLS();

// OAuth tokens for access control
export const oauthTokens = pgTable('oauth_tokens', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid
    ()`),
    organizationId: text('organization_id').references(() => organization.id).notNull(),
    clientId: uuid('client_id').references(() => oauthClients.id).notNull(),
    accessToken: varchar('access_token', {length: 255}).unique().notNull(),
    refreshToken: varchar('refresh_token', {length: 255}).unique(),
    scopes: jsonb('scopes').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastUsedAt: timestamp('last_used_at'),
    ipAddress: varchar('ip_address', {length: 45}),
    userAgent: text('user_agent'),
}, (table) => [
    // Indexes and constraints
    index('oauth_tokens_organization_idx').on(table.organizationId),
    index('oauth_tokens_client_idx').on(table.clientId),
    index('oauth_tokens_access_token_idx').on(table.accessToken),
    index('oauth_tokens_expires_idx').on(table.expiresAt),

    // RLS policies
    pgPolicy('oauth_tokens_select_policy', {
        for: 'select',
        to: [accountantRole, auditorRole, adminRole, integrationBotRole],
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_tokens_insert_policy', {
        for: 'insert',
        to: 'public', // OAuth server needs to insert tokens
        withCheck: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_tokens_update_policy', {
        for: 'update',
        to: 'public', // OAuth server needs to update last_used_at
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
        withCheck: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    }),

    pgPolicy('oauth_tokens_delete_policy', {
        for: 'delete',
        to: 'public', // OAuth server needs to delete expired/revoked tokens
        using: sql`${table.organizationId}
        =
        ${currentOrganizationId}`,
    })
]).enableRLS();