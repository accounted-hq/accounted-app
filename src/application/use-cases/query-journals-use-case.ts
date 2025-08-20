import { 
  OrganizationId, 
  PeriodId, 
  JournalId,
  JournalStatus,
  AuditContext
} from '../../domain/shared/types';
import { Result } from '../../domain/shared/result';
import { Journal } from '../../domain/journal/entities/journal';
import { Money } from '../../domain/journal/value-objects/money';
import { JournalService } from '../../domain/journal/services/journal-service';
import { ServiceContainer } from '../../infrastructure/services/service-factory';

/**
 * Use case for querying and filtering journals
 */
export class QueryJournalsUseCase {
  constructor(
    private readonly journalService: JournalService,
    private readonly services: ServiceContainer
  ) {}

  /**
   * Find journals by various criteria
   */
  async execute(query: QueryJournalsQuery): Promise<Result<QueryJournalsResponse, any>> {
    const results: Journal[] = [];

    try {
      // Query by different criteria
      if (query.journalId) {
        const result = await this.journalService.findJournal(query.journalId, query.organizationId);
        if (result.isSuccess() && result.value) {
          results.push(result.value);
        }
      } else if (query.journalNumber) {
        const result = await this.journalService.findByJournalNumber(query.journalNumber, query.organizationId);
        if (result.isSuccess() && result.value) {
          results.push(result.value);
        }
      } else if (query.extUid) {
        const result = await this.journalService.findByExternalUid(query.extUid, query.organizationId);
        if (result.isSuccess() && result.value) {
          results.push(result.value);
        }
      } else if (query.periodId) {
        const result = await this.journalService.findByPeriod(query.periodId, query.organizationId);
        if (result.isSuccess()) {
          results.push(...result.value);
        }
      } else if (query.dateRange) {
        const result = await this.journalService.findByDateRange(
          query.dateRange.startDate,
          query.dateRange.endDate,
          query.organizationId
        );
        if (result.isSuccess()) {
          results.push(...result.value);
        }
      }

      // Apply filters
      let filteredJournals = this.applyFilters(results, query);

      // Apply sorting
      filteredJournals = this.applySorting(filteredJournals, query);

      // Apply pagination
      const { paginatedJournals, totalCount } = this.applyPagination(filteredJournals, query);

      // Calculate summary statistics
      const summary = this.calculateSummary(filteredJournals);

      return {
        isSuccess: () => true,
        isFailure: () => false,
        value: {
          journals: paginatedJournals,
          totalCount,
          pageSize: query.pagination?.pageSize || totalCount,
          currentPage: query.pagination?.page || 1,
          totalPages: Math.ceil(totalCount / (query.pagination?.pageSize || totalCount)),
          summary,
          query: query
        },
        error: undefined as any
      } as Result<QueryJournalsResponse, any>;

    } catch (error) {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error
      } as Result<QueryJournalsResponse, any>;
    }
  }

  /**
   * Get journal statistics for a period or organization
   */
  async getStatistics(
    organizationId: OrganizationId,
    periodId?: PeriodId,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<Result<JournalStatistics, any>> {
    try {
      let journals: Journal[] = [];

      if (periodId) {
        const result = await this.journalService.findByPeriod(periodId, organizationId);
        if (result.isSuccess()) {
          journals = result.value;
        }
      } else if (dateRange) {
        const result = await this.journalService.findByDateRange(
          dateRange.startDate,
          dateRange.endDate,
          organizationId
        );
        if (result.isSuccess()) {
          journals = result.value;
        }
      }

      // Calculate statistics
      const stats = this.calculateDetailedStatistics(journals);

      return {
        isSuccess: () => true,
        isFailure: () => false,
        value: stats,
        error: undefined as any
      } as Result<JournalStatistics, any>;

    } catch (error) {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error
      } as Result<JournalStatistics, any>;
    }
  }

  /**
   * Apply filters to journal results
   */
  private applyFilters(journals: Journal[], query: QueryJournalsQuery): Journal[] {
    let filtered = [...journals];

    // Filter by status
    if (query.filters?.status) {
      filtered = filtered.filter(j => j.status === query.filters!.status);
    }

    // Filter by search term
    if (query.filters?.searchTerm) {
      const term = query.filters.searchTerm.toLowerCase();
      filtered = filtered.filter(j => 
        j.description.toLowerCase().includes(term) ||
        j.journalNumber.toLowerCase().includes(term) ||
        (j.reference && j.reference.toLowerCase().includes(term))
      );
    }

    // Filter by amount range
    if (query.filters?.amountRange) {
      const { minAmount, maxAmount } = query.filters.amountRange;
      filtered = filtered.filter(j => {
        const totalDebit = j.getTotalDebit().toNumber();
        return totalDebit >= minAmount && totalDebit <= maxAmount;
      });
    }

    // Filter by currency
    if (query.filters?.currency) {
      filtered = filtered.filter(j => j.currency === query.filters!.currency);
    }

    // Filter by created date range
    if (query.filters?.createdDateRange) {
      const { startDate, endDate } = query.filters.createdDateRange;
      filtered = filtered.filter(j => 
        j.createdAt >= startDate && j.createdAt <= endDate
      );
    }

    return filtered;
  }

  /**
   * Apply sorting to journal results
   */
  private applySorting(journals: Journal[], query: QueryJournalsQuery): Journal[] {
    const sortBy = query.sorting?.sortBy || 'postingDate';
    const sortOrder = query.sorting?.sortOrder || 'desc';

    const sorted = [...journals].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'journalNumber':
          comparison = a.journalNumber.localeCompare(b.journalNumber);
          break;
        case 'postingDate':
          comparison = a.postingDate.getTime() - b.postingDate.getTime();
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'totalAmount':
          comparison = a.getTotalDebit().toNumber() - b.getTotalDebit().toNumber();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Apply pagination to journal results
   */
  private applyPagination(
    journals: Journal[], 
    query: QueryJournalsQuery
  ): { paginatedJournals: Journal[]; totalCount: number } {
    const totalCount = journals.length;

    if (!query.pagination) {
      return { paginatedJournals: journals, totalCount };
    }

    const { page = 1, pageSize = 50 } = query.pagination;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      paginatedJournals: journals.slice(startIndex, endIndex),
      totalCount
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(journals: Journal[]): QuerySummary {
    const currencies = [...new Set(journals.map(j => j.currency))];
    const summaryByCurrency: Record<string, any> = {};

    for (const currency of currencies) {
      const journalsInCurrency = journals.filter(j => j.currency === currency);
      const totalDebit = journalsInCurrency.reduce(
        (sum, j) => sum.add(j.getTotalDebit()),
        Money.zero(currency)
      );
      const totalCredit = journalsInCurrency.reduce(
        (sum, j) => sum.add(j.getTotalCredit()),
        Money.zero(currency)
      );

      summaryByCurrency[currency] = {
        count: journalsInCurrency.length,
        totalDebit,
        totalCredit
      };
    }

    const statusCounts = {
      draft: journals.filter(j => j.status === 'draft').length,
      posted: journals.filter(j => j.status === 'posted').length,
      reversed: journals.filter(j => j.status === 'reversed').length
    };

    return {
      totalJournals: journals.length,
      statusCounts,
      currencySummary: summaryByCurrency,
      dateRange: journals.length > 0 ? {
        earliest: Math.min(...journals.map(j => j.postingDate.getTime())),
        latest: Math.max(...journals.map(j => j.postingDate.getTime()))
      } : null
    };
  }

  /**
   * Calculate detailed statistics
   */
  private calculateDetailedStatistics(journals: Journal[]): JournalStatistics {
    const summary = this.calculateSummary(journals);
    
    return {
      ...summary,
      averageJournalSize: journals.length > 0 ? 
        journals.reduce((sum, j) => sum + j.lines.length, 0) / journals.length : 0,
      mostRecentPosting: journals
        .filter(j => j.status === 'posted')
        .sort((a, b) => (b.postedAt?.getTime() || 0) - (a.postedAt?.getTime() || 0))[0]?.postedAt,
      oldestDraft: journals
        .filter(j => j.status === 'draft')
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt
    };
  }
}

export interface QueryJournalsQuery {
  readonly organizationId: OrganizationId;
  
  // Single journal queries
  readonly journalId?: JournalId;
  readonly journalNumber?: string;
  readonly extUid?: string;
  
  // Multi-journal queries
  readonly periodId?: PeriodId;
  readonly dateRange?: {
    readonly startDate: Date;
    readonly endDate: Date;
  };
  
  // Filters
  readonly filters?: {
    readonly status?: JournalStatus;
    readonly searchTerm?: string;
    readonly currency?: string;
    readonly amountRange?: {
      readonly minAmount: number;
      readonly maxAmount: number;
    };
    readonly createdDateRange?: {
      readonly startDate: Date;
      readonly endDate: Date;
    };
  };
  
  // Sorting
  readonly sorting?: {
    readonly sortBy?: 'journalNumber' | 'postingDate' | 'createdAt' | 'totalAmount' | 'status';
    readonly sortOrder?: 'asc' | 'desc';
  };
  
  // Pagination
  readonly pagination?: {
    readonly page: number;
    readonly pageSize: number;
  };
  
  readonly auditContext: AuditContext;
}

export interface QueryJournalsResponse {
  readonly journals: Journal[];
  readonly totalCount: number;
  readonly pageSize: number;
  readonly currentPage: number;
  readonly totalPages: number;
  readonly summary: QuerySummary;
  readonly query: QueryJournalsQuery;
}

export interface QuerySummary {
  readonly totalJournals: number;
  readonly statusCounts: {
    readonly draft: number;
    readonly posted: number;
    readonly reversed: number;
  };
  readonly currencySummary: Record<string, {
    readonly count: number;
    readonly totalDebit: any;
    readonly totalCredit: any;
  }>;
  readonly dateRange: {
    readonly earliest: number;
    readonly latest: number;
  } | null;
}

export interface JournalStatistics extends QuerySummary {
  readonly averageJournalSize: number;
  readonly mostRecentPosting?: Date;
  readonly oldestDraft?: Date;
}