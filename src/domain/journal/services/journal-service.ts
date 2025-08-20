import { 
  OrganizationId, 
  JournalId, 
  PeriodId,
  UserId,
  domainError, 
  DomainErrorCodes 
} from '../../shared/types';
import { Result, success, failure } from '../../shared/result';
import { Journal, CreateJournalProps } from '../entities/journal';
import { JournalLine } from '../entities/journal-line';
import { Money } from '../value-objects/money';
import { JournalRepository } from '../repositories/journal-repository';
import { PeriodService } from '../../period/services/period-service';
import { PostingService } from './posting-service';

/**
 * Main journal domain service
 */
export class JournalService {
  constructor(
    private readonly journalRepository: JournalRepository,
    private readonly periodService: PeriodService,
    private readonly postingService: PostingService
  ) {}

  /**
   * Create a new draft journal with validation
   */
  async createDraftJournal(props: CreateJournalProps): Promise<Result<Journal, any>> {
    // Validate period exists and allows posting
    const periodValidation = await this.periodService.validatePeriodForPosting(
      props.periodId,
      props.organizationId
    );

    if (periodValidation.isFailure()) {
      return failure(periodValidation.error);
    }

    // Validate posting date is within period
    const period = periodValidation.value;
    if (!period.containsDate(props.postingDate)) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Posting date must be within the selected period',
        {
          postingDate: props.postingDate.toISOString(),
          periodStart: period.startDate.toISOString(),
          periodEnd: period.endDate.toISOString()
        }
      ));
    }

    // Check for duplicate journal number
    const existsResult = await this.journalRepository.existsByJournalNumber(
      props.journalNumber,
      props.organizationId
    );

    if (existsResult.isFailure()) {
      return failure(existsResult.error);
    }

    if (existsResult.value) {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Journal number already exists',
        { journalNumber: props.journalNumber }
      ));
    }

    // Check for duplicate external UID if provided
    if (props.extUid) {
      const extUidExistsResult = await this.journalRepository.existsByExtUid(
        props.extUid,
        props.organizationId
      );

      if (extUidExistsResult.isFailure()) {
        return failure(extUidExistsResult.error);
      }

      if (extUidExistsResult.value) {
        return failure(domainError(
          DomainErrorCodes.BUSINESS_RULE_VIOLATION,
          'External UID already exists',
          { extUid: props.extUid }
        ));
      }
    }

    // Create the journal
    const journalResult = Journal.create(props);
    if (journalResult.isFailure()) {
      return failure(journalResult.error);
    }

    // Save the journal
    return await this.journalRepository.save(journalResult.value);
  }

  /**
   * Update a draft journal
   */
  async updateDraftJournal(
    journalId: JournalId,
    organizationId: OrganizationId,
    updates: {
      journalNumber?: string;
      description?: string;
      reference?: string;
      postingDate?: Date;
      lines?: JournalLine[];
    }
  ): Promise<Result<Journal, any>> {
    // Get the journal
    const journalResult = await this.journalRepository.findById(journalId, organizationId);
    if (journalResult.isFailure()) {
      return failure(journalResult.error);
    }

    const journal = journalResult.value;
    if (!journal) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Journal not found'
      ));
    }

    // Check if it's a draft
    if (journal.status !== 'draft') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only draft journals can be updated'
      ));
    }

    // Validate updated posting date is within period if changed
    if (updates.postingDate) {
      const periodValidation = await this.periodService.validatePeriodForPosting(
        journal.periodId,
        organizationId
      );

      if (periodValidation.isFailure()) {
        return failure(periodValidation.error);
      }

      const period = periodValidation.value;
      if (!period.containsDate(updates.postingDate)) {
        return failure(domainError(
          DomainErrorCodes.VALIDATION_FAILED,
          'Posting date must be within the journal period',
          {
            postingDate: updates.postingDate.toISOString(),
            periodStart: period.startDate.toISOString(),
            periodEnd: period.endDate.toISOString()
          }
        ));
      }
    }

    // Check for duplicate journal number if changed
    if (updates.journalNumber && updates.journalNumber !== journal.journalNumber) {
      const existsResult = await this.journalRepository.existsByJournalNumber(
        updates.journalNumber,
        organizationId
      );

      if (existsResult.isFailure()) {
        return failure(existsResult.error);
      }

      if (existsResult.value) {
        return failure(domainError(
          DomainErrorCodes.BUSINESS_RULE_VIOLATION,
          'Journal number already exists',
          { journalNumber: updates.journalNumber }
        ));
      }
    }

    // Update the journal
    const updatedResult = journal.update(updates);
    if (updatedResult.isFailure()) {
      return updatedResult;
    }

    // Save the updated journal
    return await this.journalRepository.save(updatedResult.value);
  }

  /**
   * Post a journal
   */
  async postJournal(
    journalId: JournalId,
    organizationId: OrganizationId,
    postedBy: UserId
  ): Promise<Result<Journal, any>> {
    return await this.postingService.postJournal(journalId, organizationId, postedBy);
  }

  /**
   * Reverse a journal
   */
  async reverseJournal(
    journalId: JournalId,
    organizationId: OrganizationId,
    reversalDescription: string,
    reversalDate: Date,
    createdBy: UserId
  ): Promise<Result<{ original: Journal; reversal: Journal }, any>> {
    return await this.postingService.reverseJournal(
      journalId,
      organizationId,
      reversalDescription,
      reversalDate,
      createdBy
    );
  }

  /**
   * Delete a draft journal
   */
  async deleteDraftJournal(
    journalId: JournalId,
    organizationId: OrganizationId
  ): Promise<Result<void, any>> {
    // Get the journal to verify it's a draft
    const journalResult = await this.journalRepository.findById(journalId, organizationId);
    if (journalResult.isFailure()) {
      return failure(journalResult.error);
    }

    const journal = journalResult.value;
    if (!journal) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Journal not found'
      ));
    }

    if (journal.status !== 'draft') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only draft journals can be deleted'
      ));
    }

    return await this.journalRepository.delete(journalId, organizationId);
  }

  /**
   * Find journal by ID
   */
  async findJournal(
    journalId: JournalId,
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return await this.journalRepository.findById(journalId, organizationId);
  }

  /**
   * Find journal by journal number
   */
  async findByJournalNumber(
    journalNumber: string,
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return await this.journalRepository.findByJournalNumber(journalNumber, organizationId);
  }

  /**
   * Find journal by external UID
   */
  async findByExternalUid(
    extUid: string,
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return await this.journalRepository.findByExtUid(extUid, organizationId);
  }

  /**
   * Find journals by period
   */
  async findByPeriod(
    periodId: PeriodId,
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>> {
    return await this.journalRepository.findByPeriod(periodId, organizationId);
  }

  /**
   * Find journals by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>> {
    return await this.journalRepository.findByDateRange(startDate, endDate, organizationId);
  }

  /**
   * Get next available journal number
   */
  async getNextJournalNumber(
    organizationId: OrganizationId,
    prefix?: string
  ): Promise<Result<string, any>> {
    return await this.journalRepository.getNextJournalNumber(organizationId, prefix);
  }

  /**
   * Validate journal for import scenarios
   */
  async validateJournalForImport(props: CreateJournalProps): Promise<Result<ValidationResult, any>> {
    const issues: ValidationIssue[] = [];

    // Check period exists and is open
    const periodValidation = await this.periodService.validatePeriodForPosting(
      props.periodId,
      props.organizationId
    );

    if (periodValidation.isFailure()) {
      issues.push({
        field: 'periodId',
        code: 'PERIOD_INVALID',
        message: 'Period is not open for posting'
      });
    } else {
      const period = periodValidation.value;
      if (!period.containsDate(props.postingDate)) {
        issues.push({
          field: 'postingDate',
          code: 'DATE_OUTSIDE_PERIOD',
          message: 'Posting date is outside period range'
        });
      }
    }

    // Check for duplicates
    const journalNumExists = await this.journalRepository.existsByJournalNumber(
      props.journalNumber,
      props.organizationId
    );

    if (journalNumExists.isSuccess() && journalNumExists.value) {
      issues.push({
        field: 'journalNumber',
        code: 'DUPLICATE_JOURNAL_NUMBER',
        message: 'Journal number already exists'
      });
    }

    if (props.extUid) {
      const extUidExists = await this.journalRepository.existsByExtUid(
        props.extUid,
        props.organizationId
      );

      if (extUidExists.isSuccess() && extUidExists.value) {
        issues.push({
          field: 'extUid',
          code: 'DUPLICATE_EXT_UID',
          message: 'External UID already exists'
        });
      }
    }

    // Validate journal business rules
    const journalValidation = Journal.create(props);
    if (journalValidation.isFailure()) {
      issues.push({
        field: 'journal',
        code: 'JOURNAL_INVALID',
        message: journalValidation.error.message
      });
    }

    return success({
      isValid: issues.length === 0,
      issues
    });
  }
}

export interface ValidationResult {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
}

export interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}