/**
 * Shared domain types and branded types for type safety
 */

// Branded types for better type safety
export type Brand<T, B> = T & { readonly __brand: B };

// Domain IDs
export type OrganizationId = Brand<string, 'OrganizationId'>;
export type UserId = Brand<string, 'UserId'>;
export type JournalId = Brand<string, 'JournalId'>;
export type PeriodId = Brand<string, 'PeriodId'>;
export type AccountId = Brand<string, 'AccountId'>;

// Value object types
export type Currency = Brand<string, 'Currency'>;
export type Amount = Brand<string, 'Amount'>; // Using string for decimal precision
export type Hash = Brand<string, 'Hash'>;

// Domain enums
export type JournalStatus = 'draft' | 'posted' | 'reversed';
export type PeriodStatus = 'open' | 'closing' | 'closed';
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type UserRole = 'accountant' | 'auditor' | 'admin' | 'integration-bot';

// Helper functions for creating branded types
export const organizationId = (value: string): OrganizationId => value as OrganizationId;
export const userId = (value: string): UserId => value as UserId;
export const journalId = (value: string): JournalId => value as JournalId;
export const periodId = (value: string): PeriodId => value as PeriodId;
export const accountId = (value: string): AccountId => value as AccountId;
export const currency = (value: string): Currency => value as Currency;
export const amount = (value: string): Amount => value as Amount;
export const hash = (value: string): Hash => value as Hash;

// Common domain errors
export interface DomainError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export const domainError = (
  code: string,
  message: string,
  details?: Record<string, unknown>
): DomainError => ({
  code,
  message,
  details,
});

// Common domain error codes
export const DomainErrorCodes = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  PERIOD_CLOSED: 'PERIOD_CLOSED',
  JOURNAL_ALREADY_POSTED: 'JOURNAL_ALREADY_POSTED',
  UNBALANCED_JOURNAL: 'UNBALANCED_JOURNAL',
  INVALID_HASH_CHAIN: 'INVALID_HASH_CHAIN',
} as const;

// Audit context for tracking changes
export interface AuditContext {
  readonly userId: UserId;
  readonly userRole: UserRole;
  readonly timestamp: Date;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

// Organization context for multi-tenancy
export interface OrganizationContext {
  readonly organizationId: OrganizationId;
  readonly userId?: UserId;
  readonly userRole?: UserRole;
}