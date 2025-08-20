import { ServiceContainer, createServiceContainer } from '../../infrastructure/services/service-factory';
import { CreateJournalUseCase } from './create-journal-use-case';
import { PostJournalUseCase } from './post-journal-use-case';
import { ReverseJournalUseCase } from './reverse-journal-use-case';
import { CreatePeriodUseCase } from './create-period-use-case';
import { QueryJournalsUseCase } from './query-journals-use-case';

/**
 * Factory for creating use case instances with proper dependency injection
 */
export class UseCaseFactory {
  private static _services: ServiceContainer | null = null;
  
  // Use case instances
  private static _createJournalUseCase: CreateJournalUseCase | null = null;
  private static _postJournalUseCase: PostJournalUseCase | null = null;
  private static _reverseJournalUseCase: ReverseJournalUseCase | null = null;
  private static _createPeriodUseCase: CreatePeriodUseCase | null = null;
  private static _queryJournalsUseCase: QueryJournalsUseCase | null = null;

  /**
   * Get services container
   */
  private static getServices(): ServiceContainer {
    if (!this._services) {
      this._services = createServiceContainer();
    }
    return this._services;
  }

  /**
   * Get create journal use case
   */
  static getCreateJournalUseCase(): CreateJournalUseCase {
    if (!this._createJournalUseCase) {
      const services = this.getServices();
      this._createJournalUseCase = new CreateJournalUseCase(
        services.journalService,
        services
      );
    }
    return this._createJournalUseCase;
  }

  /**
   * Get post journal use case
   */
  static getPostJournalUseCase(): PostJournalUseCase {
    if (!this._postJournalUseCase) {
      const services = this.getServices();
      this._postJournalUseCase = new PostJournalUseCase(
        services.journalService,
        services.hashService,
        services
      );
    }
    return this._postJournalUseCase;
  }

  /**
   * Get reverse journal use case
   */
  static getReverseJournalUseCase(): ReverseJournalUseCase {
    if (!this._reverseJournalUseCase) {
      const services = this.getServices();
      this._reverseJournalUseCase = new ReverseJournalUseCase(
        services.journalService,
        services
      );
    }
    return this._reverseJournalUseCase;
  }

  /**
   * Get create period use case
   */
  static getCreatePeriodUseCase(): CreatePeriodUseCase {
    if (!this._createPeriodUseCase) {
      const services = this.getServices();
      this._createPeriodUseCase = new CreatePeriodUseCase(
        services.periodService,
        services
      );
    }
    return this._createPeriodUseCase;
  }

  /**
   * Get query journals use case
   */
  static getQueryJournalsUseCase(): QueryJournalsUseCase {
    if (!this._queryJournalsUseCase) {
      const services = this.getServices();
      this._queryJournalsUseCase = new QueryJournalsUseCase(
        services.journalService,
        services
      );
    }
    return this._queryJournalsUseCase;
  }

  /**
   * Set custom services container (for testing)
   */
  static setServices(services: ServiceContainer): void {
    this._services = services;
    this.reset();
  }

  /**
   * Reset all use cases (for testing)
   */
  static reset(): void {
    this._createJournalUseCase = null;
    this._postJournalUseCase = null;
    this._reverseJournalUseCase = null;
    this._createPeriodUseCase = null;
    this._queryJournalsUseCase = null;
  }
}

/**
 * Use case container for dependency injection
 */
export interface UseCaseContainer {
  createJournal: CreateJournalUseCase;
  postJournal: PostJournalUseCase;
  reverseJournal: ReverseJournalUseCase;
  createPeriod: CreatePeriodUseCase;
  queryJournals: QueryJournalsUseCase;
}

/**
 * Create use case container with default implementations
 */
export function createUseCaseContainer(): UseCaseContainer {
  return {
    createJournal: UseCaseFactory.getCreateJournalUseCase(),
    postJournal: UseCaseFactory.getPostJournalUseCase(),
    reverseJournal: UseCaseFactory.getReverseJournalUseCase(),
    createPeriod: UseCaseFactory.getCreatePeriodUseCase(),
    queryJournals: UseCaseFactory.getQueryJournalsUseCase()
  };
}