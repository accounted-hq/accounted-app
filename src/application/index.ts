/**
 * Application layer exports
 * This provides the main entry point for accessing use cases
 */

// Use case exports
export { CreateJournalUseCase } from './use-cases/create-journal-use-case';
export { PostJournalUseCase } from './use-cases/post-journal-use-case';
export { ReverseJournalUseCase } from './use-cases/reverse-journal-use-case';
export { CreatePeriodUseCase } from './use-cases/create-period-use-case';
export { QueryJournalsUseCase } from './use-cases/query-journals-use-case';

// Factory exports
export { UseCaseFactory, createUseCaseContainer } from './use-cases/use-case-factory';

// Type exports
export type { UseCaseContainer } from './use-cases/use-case-factory';

// Command and response type exports
export type { 
  CreateJournalCommand, 
  CreateJournalResponse,
  CreateJournalLineCommand
} from './use-cases/create-journal-use-case';

export type { 
  PostJournalCommand, 
  PostJournalResponse,
  PostingValidationResult
} from './use-cases/post-journal-use-case';

export type { 
  ReverseJournalCommand, 
  ReverseJournalResponse,
  ReversalValidationResult,
  ReversalPreview
} from './use-cases/reverse-journal-use-case';

export type { 
  CreatePeriodCommand, 
  CreatePeriodResponse,
  PeriodValidationResult
} from './use-cases/create-period-use-case';

export type { 
  QueryJournalsQuery, 
  QueryJournalsResponse,
  QuerySummary,
  JournalStatistics
} from './use-cases/query-journals-use-case';

// Re-export infrastructure for convenience
export * from '../infrastructure';
export * from '../domain/shared/types';
export { Result, success, failure } from '../domain/shared/result';