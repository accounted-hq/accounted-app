import { PeriodService } from '../../domain/period/services/period-service';
import { JournalService } from '../../domain/journal/services/journal-service';
import { HashService } from '../../domain/journal/services/hash-service';
import { PostingService } from '../../domain/journal/services/posting-service';
import { RepositoryContainer, createRepositoryContainer } from '../repositories/repository-factory';

/**
 * Factory for creating domain service instances with proper dependency injection
 */
export class ServiceFactory {
  private static _repositories: RepositoryContainer | null = null;
  private static _periodService: PeriodService | null = null;
  private static _hashService: HashService | null = null;
  private static _postingService: PostingService | null = null;
  private static _journalService: JournalService | null = null;

  /**
   * Get repositories container
   */
  private static getRepositories(): RepositoryContainer {
    if (!this._repositories) {
      this._repositories = createRepositoryContainer();
    }
    return this._repositories;
  }

  /**
   * Get period service instance
   */
  static getPeriodService(): PeriodService {
    if (!this._periodService) {
      const repositories = this.getRepositories();
      this._periodService = new PeriodService(repositories.periodRepository);
    }
    return this._periodService;
  }

  /**
   * Get hash service instance
   */
  static getHashService(): HashService {
    if (!this._hashService) {
      const repositories = this.getRepositories();
      this._hashService = new HashService(repositories.journalRepository);
    }
    return this._hashService;
  }

  /**
   * Get posting service instance
   */
  static getPostingService(): PostingService {
    if (!this._postingService) {
      const repositories = this.getRepositories();
      this._postingService = new PostingService(
        repositories.journalRepository,
        repositories.periodRepository,
        this.getHashService()
      );
    }
    return this._postingService;
  }

  /**
   * Get journal service instance
   */
  static getJournalService(): JournalService {
    if (!this._journalService) {
      const repositories = this.getRepositories();
      this._journalService = new JournalService(
        repositories.journalRepository,
        this.getPeriodService(),
        this.getPostingService()
      );
    }
    return this._journalService;
  }

  /**
   * Set custom repositories (for testing)
   */
  static setRepositories(repositories: RepositoryContainer): void {
    this._repositories = repositories;
    // Reset services to use new repositories
    this.reset();
  }

  /**
   * Reset all services (for testing)
   */
  static reset(): void {
    this._periodService = null;
    this._hashService = null;
    this._postingService = null;
    this._journalService = null;
  }
}

/**
 * Service container for dependency injection
 */
export interface ServiceContainer {
  periodService: PeriodService;
  journalService: JournalService;
  hashService: HashService;
  postingService: PostingService;
}

/**
 * Create service container with default implementations
 */
export function createServiceContainer(): ServiceContainer {
  return {
    periodService: ServiceFactory.getPeriodService(),
    journalService: ServiceFactory.getJournalService(),
    hashService: ServiceFactory.getHashService(),
    postingService: ServiceFactory.getPostingService()
  };
}