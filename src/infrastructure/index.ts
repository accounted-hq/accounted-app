/**
 * Infrastructure layer exports
 * This provides the main entry point for accessing domain services and repositories
 */

// Repository exports
export { RepositoryFactory, createRepositoryContainer } from './repositories/repository-factory';
export { DrizzlePeriodRepository } from './repositories/drizzle-period-repository';
export { DrizzleJournalRepository } from './repositories/drizzle-journal-repository';

// Service exports
export { ServiceFactory, createServiceContainer } from './services/service-factory';

// Type exports
export type { RepositoryContainer } from './repositories/repository-factory';
export type { ServiceContainer } from './services/service-factory';

// Domain service re-exports for convenience
export { PeriodService } from '../domain/period/services/period-service';
export { JournalService } from '../domain/journal/services/journal-service';
export { HashService } from '../domain/journal/services/hash-service';
export { PostingService } from '../domain/journal/services/posting-service';

// Domain entity re-exports
export { Period } from '../domain/period/entities/period';
export { Journal } from '../domain/journal/entities/journal';
export { JournalLine } from '../domain/journal/entities/journal-line';

// Value object re-exports
export { Money } from '../domain/journal/value-objects/money';
export { JournalHash } from '../domain/journal/value-objects/journal-hash';

// Shared types re-exports
export * from '../domain/shared/types';
export { Result, success, failure } from '../domain/shared/result';