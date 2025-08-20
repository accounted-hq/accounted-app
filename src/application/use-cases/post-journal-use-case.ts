import { 
  OrganizationId, 
  JournalId, 
  UserId,
  AuditContext
} from '../../domain/shared/types';
import { Result } from '../../domain/shared/result';
import { Journal } from '../../domain/journal/entities/journal';
import { JournalService } from '../../domain/journal/services/journal-service';
import { HashService } from '../../domain/journal/services/hash-service';
import { ServiceContainer } from '../../infrastructure/services/service-factory';

/**
 * Use case for posting a draft journal entry
 */
export class PostJournalUseCase {
  constructor(
    private readonly journalService: JournalService,
    private readonly hashService: HashService,
    private readonly services: ServiceContainer
  ) {}

  async execute(command: PostJournalCommand): Promise<Result<PostJournalResponse, any>> {
    // Get the journal first to validate it exists and is a draft
    const journalResult = await this.journalService.findJournal(
      command.journalId, 
      command.organizationId
    );

    if (journalResult.isFailure()) {
      return journalResult;
    }

    if (!journalResult.value) {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error: {
          code: 'JOURNAL_NOT_FOUND',
          message: 'Journal not found'
        }
      } as Result<PostJournalResponse, any>;
    }

    const journal = journalResult.value;

    // Validate journal is in draft status
    if (journal.status !== 'draft') {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error: {
          code: 'JOURNAL_NOT_DRAFT',
          message: 'Only draft journals can be posted'
        }
      } as Result<PostJournalResponse, any>;
    }

    // Post the journal
    const postResult = await this.journalService.postJournal(
      command.journalId,
      command.organizationId,
      command.auditContext.userId
    );

    if (postResult.isFailure()) {
      return postResult;
    }

    const postedJournal = postResult.value;

    // Verify hash chain integrity after posting
    if (postedJournal.hashSelf) {
      const hashVerification = await this.hashService.verifyHashChain(postedJournal);
      if (hashVerification.isFailure()) {
        // Log warning but don't fail the operation
        console.warn('Hash verification failed for posted journal:', {
          journalId: postedJournal.id,
          error: hashVerification.error
        });
      }
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        journal: postedJournal,
        journalId: postedJournal.id,
        journalNumber: postedJournal.journalNumber,
        status: postedJournal.status,
        postedAt: postedJournal.postedAt!,
        postedBy: postedJournal.postedBy!,
        hashSelf: postedJournal.hashSelf?.value,
        hashPrev: postedJournal.hashPrev?.value,
        totalDebit: postedJournal.getTotalDebit(),
        totalCredit: postedJournal.getTotalCredit()
      },
      error: undefined as any
    } as Result<PostJournalResponse, any>;
  }

  /**
   * Validate journal for posting with detailed checks
   */
  async validateForPosting(
    journalId: JournalId,
    organizationId: OrganizationId
  ): Promise<Result<PostingValidationResult, any>> {
    const journalResult = await this.journalService.findJournal(journalId, organizationId);
    
    if (journalResult.isFailure()) {
      return journalResult;
    }

    if (!journalResult.value) {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error: {
          code: 'JOURNAL_NOT_FOUND',
          message: 'Journal not found'
        }
      } as Result<PostingValidationResult, any>;
    }

    const journal = journalResult.value;
    const issues: ValidationIssue[] = [];

    // Check status
    if (journal.status !== 'draft') {
      issues.push({
        field: 'status',
        code: 'INVALID_STATUS',
        message: 'Only draft journals can be posted'
      });
    }

    // Check balance
    if (!journal.isBalanced()) {
      issues.push({
        field: 'balance',
        code: 'UNBALANCED',
        message: 'Journal is not balanced',
        details: {
          totalDebit: journal.getTotalDebit().toString(),
          totalCredit: journal.getTotalCredit().toString()
        }
      });
    }

    // Check lines
    if (journal.lines.length === 0) {
      issues.push({
        field: 'lines',
        code: 'NO_LINES',
        message: 'Journal must have at least one line'
      });
    }

    // Validate each line
    for (let i = 0; i < journal.lines.length; i++) {
      const line = journal.lines[i];
      
      if (line.debitAmount.isZero() && line.creditAmount.isZero()) {
        issues.push({
          field: `lines[${i}]`,
          code: 'ZERO_AMOUNT',
          message: `Line ${line.lineNumber} has zero amount`
        });
      }

      if (!line.debitAmount.isZero() && !line.creditAmount.isZero()) {
        issues.push({
          field: `lines[${i}]`,
          code: 'BOTH_AMOUNTS',
          message: `Line ${line.lineNumber} has both debit and credit amounts`
        });
      }

      if (!line.validateExchangeCalculation()) {
        issues.push({
          field: `lines[${i}]`,
          code: 'INVALID_EXCHANGE_RATE',
          message: `Line ${line.lineNumber} has invalid exchange rate calculation`
        });
      }
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        isValid: issues.length === 0,
        issues,
        journal
      },
      error: undefined as any
    } as Result<PostingValidationResult, any>;
  }
}

export interface PostJournalCommand {
  readonly journalId: JournalId;
  readonly organizationId: OrganizationId;
  readonly auditContext: AuditContext;
}

export interface PostJournalResponse {
  readonly journal: Journal;
  readonly journalId: any;
  readonly journalNumber: string;
  readonly status: string;
  readonly postedAt: Date;
  readonly postedBy: UserId;
  readonly hashSelf?: string;
  readonly hashPrev?: string;
  readonly totalDebit: any;
  readonly totalCredit: any;
}

export interface PostingValidationResult {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly journal: Journal;
}

export interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly details?: any;
}