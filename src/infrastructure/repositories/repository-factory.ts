import { PeriodRepository } from '../../domain/period/repositories/period-repository';
import { JournalRepository } from '../../domain/journal/repositories/journal-repository';
import { DrizzlePeriodRepository } from './drizzle-period-repository';
import { DrizzleJournalRepository } from './drizzle-journal-repository';

/**
 * Factory for creating repository instances
 * This allows for easy swapping of implementations (e.g., for testing)
 */
export class RepositoryFactory {
  private static _periodRepository: PeriodRepository | null = null;
  private static _journalRepository: JournalRepository | null = null;

  /**
   * Get period repository instance
   */
  static getPeriodRepository(): PeriodRepository {
    if (!this._periodRepository) {
      this._periodRepository = new DrizzlePeriodRepository();
    }
    return this._periodRepository;
  }

  /**
   * Get journal repository instance
   */
  static getJournalRepository(): JournalRepository {
    if (!this._journalRepository) {
      this._journalRepository = new DrizzleJournalRepository();
    }
    return this._journalRepository;
  }

  /**
   * Set custom period repository (for testing)
   */
  static setPeriodRepository(repository: PeriodRepository): void {
    this._periodRepository = repository;
  }

  /**
   * Set custom journal repository (for testing)
   */
  static setJournalRepository(repository: JournalRepository): void {
    this._journalRepository = repository;
  }

  /**
   * Reset all repositories (for testing)
   */
  static reset(): void {
    this._periodRepository = null;
    this._journalRepository = null;
  }
}

/**
 * Repository container for dependency injection
 */
export interface RepositoryContainer {
  periodRepository: PeriodRepository;
  journalRepository: JournalRepository;
}

/**
 * Create repository container with default implementations
 */
export function createRepositoryContainer(): RepositoryContainer {
  return {
    periodRepository: RepositoryFactory.getPeriodRepository(),
    journalRepository: RepositoryFactory.getJournalRepository()
  };
}