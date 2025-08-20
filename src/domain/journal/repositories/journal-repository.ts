import { OrganizationId, JournalId, PeriodId } from '../../shared/types';
import { Result } from '../../shared/result';
import { Journal } from '../entities/journal';
import { JournalHash } from '../value-objects/journal-hash';

/**
 * Journal repository interface for data access
 */
export interface JournalRepository {
  /**
   * Find journal by ID
   */
  findById(journalId: JournalId, organizationId: OrganizationId): Promise<Result<Journal | null, any>>;

  /**
   * Find journal by external UID
   */
  findByExtUid(extUid: string, organizationId: OrganizationId): Promise<Result<Journal | null, any>>;

  /**
   * Find journal by journal number
   */
  findByJournalNumber(journalNumber: string, organizationId: OrganizationId): Promise<Result<Journal | null, any>>;

  /**
   * Find all journals in a period
   */
  findByPeriod(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<Journal[], any>>;

  /**
   * Find posted journals in chronological order for hash chaining
   */
  findPostedJournalsChronological(
    organizationId: OrganizationId,
    limit?: number
  ): Promise<Result<Journal[], any>>;

  /**
   * Get the last posted journal for hash chaining
   */
  findLastPostedJournal(organizationId: OrganizationId): Promise<Result<Journal | null, any>>;

  /**
   * Find draft journals by period
   */
  findDraftJournalsByPeriod(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<Journal[], any>>;

  /**
   * Find journals by date range
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>>;

  /**
   * Check if journal number exists
   */
  existsByJournalNumber(journalNumber: string, organizationId: OrganizationId): Promise<Result<boolean, any>>;

  /**
   * Check if external UID exists
   */
  existsByExtUid(extUid: string, organizationId: OrganizationId): Promise<Result<boolean, any>>;

  /**
   * Count draft journals in period
   */
  countDraftJournalsInPeriod(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<number, any>>;

  /**
   * Save journal (insert or update)
   */
  save(journal: Journal): Promise<Result<Journal, any>>;

  /**
   * Save multiple journals in a transaction (for reversals)
   */
  saveMultiple(journals: Journal[]): Promise<Result<Journal[], any>>;

  /**
   * Delete draft journal
   */
  delete(journalId: JournalId, organizationId: OrganizationId): Promise<Result<void, any>>;

  /**
   * Get next available journal number
   */
  getNextJournalNumber(organizationId: OrganizationId, prefix?: string): Promise<Result<string, any>>;
}

/**
 * Journal query options for advanced searches
 */
export interface JournalQueryOptions {
  readonly periodId?: PeriodId;
  readonly status?: 'draft' | 'posted' | 'reversed';
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly searchTerm?: string; // Search in description, reference
  readonly limit?: number;
  readonly offset?: number;
  readonly sortBy?: 'postingDate' | 'journalNumber' | 'createdAt';
  readonly sortOrder?: 'asc' | 'desc';
}