import { 
  OrganizationId, 
  JournalId, 
  UserId, 
  domainError, 
  DomainErrorCodes 
} from '../../shared/types';
import { Result, success, failure } from '../../shared/result';
import { Journal } from '../entities/journal';
import { JournalRepository } from '../repositories/journal-repository';
import { PeriodRepository } from '../../period/repositories/period-repository';
import { HashService } from './hash-service';

/**
 * Posting service for journal posting business logic
 */
export class PostingService {
  constructor(
    private readonly journalRepository: JournalRepository,
    private readonly periodRepository: PeriodRepository,
    private readonly hashService: HashService
  ) {}

  /**
   * Post a draft journal with all validation
   */
  async postJournal(
    journalId: JournalId,
    organizationId: OrganizationId,
    postedBy: UserId
  ): Promise<Result<Journal, any>> {
    // 1. Get the journal
    const journalResult = await this.journalRepository.findById(journalId, organizationId);
    if (journalResult.isFailure()) {
      return journalResult;
    }

    const journal = journalResult.value;
    if (!journal) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Journal not found'
      ));
    }

    // 2. Validate journal can be posted
    const validationResult = await this.validateJournalForPosting(journal);
    if (validationResult.isFailure()) {
      return validationResult;
    }

    // 3. Validate period is open
    const periodResult = await this.periodRepository.findById(journal.periodId, organizationId);
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    if (!period.allowsPosting()) {
      return failure(domainError(
        DomainErrorCodes.PERIOD_CLOSED,
        'Cannot post to closed or closing period',
        { 
          periodId: period.id,
          periodStatus: period.status,
          periodName: period.name
        }
      ));
    }

    // 4. Get previous hash for chaining
    const previousHashResult = await this.hashService.getPreviousHash(organizationId);
    if (previousHashResult.isFailure()) {
      return previousHashResult;
    }

    // 5. Post the journal
    const postedResult = journal.post(postedBy, previousHashResult.value);
    if (postedResult.isFailure()) {
      return postedResult;
    }

    // 6. Save the posted journal
    return await this.journalRepository.save(postedResult.value);
  }

  /**
   * Reverse a posted journal
   */
  async reverseJournal(
    originalJournalId: JournalId,
    organizationId: OrganizationId,
    reversalDescription: string,
    reversalDate: Date,
    createdBy: UserId
  ): Promise<Result<{ original: Journal; reversal: Journal }, any>> {
    // 1. Get the original journal
    const originalResult = await this.journalRepository.findById(originalJournalId, organizationId);
    if (originalResult.isFailure()) {
      return originalResult;
    }

    const original = originalResult.value;
    if (!original) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Original journal not found'
      ));
    }

    // 2. Validate journal can be reversed
    if (original.status !== 'posted') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only posted journals can be reversed'
      ));
    }

    if (original.reversalJournalId) {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Journal has already been reversed'
      ));
    }

    // 3. Validate reversal period is open
    const reversalPeriodResult = await this.periodRepository.findByDate(reversalDate, organizationId);
    if (reversalPeriodResult.isFailure()) {
      return reversalPeriodResult;
    }

    const reversalPeriod = reversalPeriodResult.value;
    if (!reversalPeriod) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'No period found for reversal date'
      ));
    }

    if (!reversalPeriod.allowsPosting()) {
      return failure(domainError(
        DomainErrorCodes.PERIOD_CLOSED,
        'Cannot post reversal to closed or closing period',
        { 
          periodId: reversalPeriod.id,
          periodStatus: reversalPeriod.status
        }
      ));
    }

    // 4. Generate reversal journal ID
    const reversalJournalId = await this.generateJournalId();

    // 5. Create reversal journal
    const reversalResult = original.createReversal(
      reversalJournalId,
      reversalDescription,
      reversalDate,
      createdBy
    );

    if (reversalResult.isFailure()) {
      return reversalResult;
    }

    const reversalJournal = reversalResult.value;

    // 6. Post the reversal journal
    const previousHashResult = await this.hashService.getPreviousHash(organizationId);
    if (previousHashResult.isFailure()) {
      return previousHashResult;
    }

    const postedReversalResult = reversalJournal.post(createdBy, previousHashResult.value);
    if (postedReversalResult.isFailure()) {
      return postedReversalResult;
    }

    // 7. Mark original as reversed
    const reversedOriginal = new Journal(
      original.id,
      original.organizationId,
      original.periodId,
      original.journalNumber,
      original.description,
      original.reference,
      original.postingDate,
      'reversed',
      original.currency,
      original.lines,
      original.hashPrev,
      original.hashSelf,
      reversalJournalId,
      original.originalJournalId,
      original.extUid,
      original.createdBy,
      original.postedBy,
      original.postedAt,
      original.createdAt,
      new Date()
    );

    // 8. Save both journals in transaction
    const saveResult = await this.journalRepository.saveMultiple([
      reversedOriginal,
      postedReversalResult.value
    ]);

    if (saveResult.isFailure()) {
      return saveResult;
    }

    const [savedOriginal, savedReversal] = saveResult.value;

    return success({
      original: savedOriginal,
      reversal: savedReversal
    });
  }

  /**
   * Validate journal business rules for posting
   */
  private async validateJournalForPosting(journal: Journal): Promise<Result<void, any>> {
    // Check journal status
    if (journal.status !== 'draft') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only draft journals can be posted'
      ));
    }

    // Check journal is balanced
    if (!journal.isBalanced()) {
      return failure(domainError(
        DomainErrorCodes.UNBALANCED_JOURNAL,
        'Journal is not balanced',
        {
          totalDebit: journal.getTotalDebit().toString(),
          totalCredit: journal.getTotalCredit().toString()
        }
      ));
    }

    // Check journal has lines
    if (journal.lines.length === 0) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Journal must have at least one line'
      ));
    }

    // Check for duplicate journal number
    const existsResult = await this.journalRepository.existsByJournalNumber(
      journal.journalNumber,
      journal.organizationId
    );

    if (existsResult.isFailure()) {
      return existsResult;
    }

    if (existsResult.value) {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Journal number already exists',
        { journalNumber: journal.journalNumber }
      ));
    }

    // Check external UID uniqueness if provided
    if (journal.extUid) {
      const extUidExistsResult = await this.journalRepository.existsByExtUid(
        journal.extUid,
        journal.organizationId
      );

      if (extUidExistsResult.isFailure()) {
        return extUidExistsResult;
      }

      if (extUidExistsResult.value) {
        return failure(domainError(
          DomainErrorCodes.BUSINESS_RULE_VIOLATION,
          'External UID already exists',
          { extUid: journal.extUid }
        ));
      }
    }

    return success(undefined);
  }

  /**
   * Get posting statistics for a period
   */
  async getPostingStatistics(
    periodId: PeriodId,
    organizationId: OrganizationId
  ): Promise<Result<PostingStatistics, any>> {
    const journalsResult = await this.journalRepository.findByPeriod(periodId, organizationId);
    if (journalsResult.isFailure()) {
      return failure(journalsResult.error);
    }

    const journals = journalsResult.value;
    
    const statistics: PostingStatistics = {
      totalJournals: journals.length,
      draftJournals: journals.filter(j => j.status === 'draft').length,
      postedJournals: journals.filter(j => j.status === 'posted').length,
      reversedJournals: journals.filter(j => j.status === 'reversed').length,
      totalDebitAmount: journals
        .filter(j => j.status === 'posted')
        .reduce((sum, j) => sum.add(j.getTotalDebit()), 
                journals[0]?.getTotalDebit().multiply(0) || null),
      totalCreditAmount: journals
        .filter(j => j.status === 'posted')
        .reduce((sum, j) => sum.add(j.getTotalCredit()), 
                journals[0]?.getTotalCredit().multiply(0) || null)
    };

    return success(statistics);
  }

  /**
   * Generate a new journal ID (placeholder - would use UUID in real implementation)
   */
  private async generateJournalId(): Promise<JournalId> {
    // This would typically use a UUID generator
    return `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as JournalId;
  }
}

export interface PostingStatistics {
  readonly totalJournals: number;
  readonly draftJournals: number;
  readonly postedJournals: number;
  readonly reversedJournals: number;
  readonly totalDebitAmount: any; // Money type
  readonly totalCreditAmount: any; // Money type
}

// Re-export for convenience
export { HashService } from './hash-service';