import { 
  OrganizationId, 
  JournalId, 
  UserId,
  AuditContext
} from '../../domain/shared/types';
import { Result } from '../../domain/shared/result';
import { Journal } from '../../domain/journal/entities/journal';
import { JournalService } from '../../domain/journal/services/journal-service';
import { ServiceContainer } from '../../infrastructure/services/service-factory';

/**
 * Use case for reversing a posted journal entry
 */
export class ReverseJournalUseCase {
  constructor(
    private readonly journalService: JournalService,
    private readonly services: ServiceContainer
  ) {}

  async execute(command: ReverseJournalCommand): Promise<Result<ReverseJournalResponse, any>> {
    // Get the original journal to validate it
    const journalResult = await this.journalService.findJournal(
      command.originalJournalId,
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
          message: 'Original journal not found'
        }
      } as Result<ReverseJournalResponse, any>;
    }

    const originalJournal = journalResult.value;

    // Validate journal can be reversed
    if (originalJournal.status !== 'posted') {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error: {
          code: 'JOURNAL_NOT_POSTED',
          message: 'Only posted journals can be reversed'
        }
      } as Result<ReverseJournalResponse, any>;
    }

    if (originalJournal.reversalJournalId) {
      return {
        isSuccess: () => false,
        isFailure: () => true,
        value: undefined as any,
        error: {
          code: 'ALREADY_REVERSED',
          message: 'Journal has already been reversed',
          details: {
            reversalJournalId: originalJournal.reversalJournalId
          }
        }
      } as Result<ReverseJournalResponse, any>;
    }

    // Create the reversal description
    const reversalDescription = command.description || 
      `REVERSAL: ${originalJournal.description}`;

    // Reverse the journal
    const reversalResult = await this.journalService.reverseJournal(
      command.originalJournalId,
      command.organizationId,
      reversalDescription,
      command.reversalDate,
      command.auditContext.userId
    );

    if (reversalResult.isFailure()) {
      return reversalResult;
    }

    const { original, reversal } = reversalResult.value;

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        originalJournal: original,
        reversalJournal: reversal,
        originalJournalId: original.id,
        reversalJournalId: reversal.id,
        originalJournalNumber: original.journalNumber,
        reversalJournalNumber: reversal.journalNumber,
        reversalDate: command.reversalDate,
        reversalDescription,
        reversedBy: command.auditContext.userId,
        totalReversedAmount: reversal.getTotalDebit(), // Both should be equal
        originalPostingDate: original.postingDate,
        reversalPostingDate: reversal.postingDate
      },
      error: undefined as any
    } as Result<ReverseJournalResponse, any>;
  }

  /**
   * Validate journal for reversal with detailed checks
   */
  async validateForReversal(
    journalId: JournalId,
    organizationId: OrganizationId,
    reversalDate: Date
  ): Promise<Result<ReversalValidationResult, any>> {
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
      } as Result<ReversalValidationResult, any>;
    }

    const journal = journalResult.value;
    const issues: ValidationIssue[] = [];

    // Check status
    if (journal.status !== 'posted') {
      issues.push({
        field: 'status',
        code: 'NOT_POSTED',
        message: 'Only posted journals can be reversed'
      });
    }

    // Check if already reversed
    if (journal.reversalJournalId) {
      issues.push({
        field: 'reversalStatus',
        code: 'ALREADY_REVERSED',
        message: 'Journal has already been reversed',
        details: {
          reversalJournalId: journal.reversalJournalId
        }
      });
    }

    // Check reversal date
    if (reversalDate < journal.postingDate) {
      issues.push({
        field: 'reversalDate',
        code: 'INVALID_REVERSAL_DATE',
        message: 'Reversal date cannot be before original posting date',
        details: {
          originalPostingDate: journal.postingDate.toISOString(),
          reversalDate: reversalDate.toISOString()
        }
      });
    }

    // Check if reversal date is too far in the future (business rule)
    const maxReversalDays = 365; // 1 year
    const daysDiff = Math.floor((reversalDate.getTime() - journal.postingDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > maxReversalDays) {
      issues.push({
        field: 'reversalDate',
        code: 'REVERSAL_DATE_TOO_LATE',
        message: `Reversal date cannot be more than ${maxReversalDays} days after original posting`,
        details: {
          daysDifference: daysDiff,
          maxAllowedDays: maxReversalDays
        }
      });
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        isValid: issues.length === 0,
        issues,
        journal,
        canReverse: issues.length === 0
      },
      error: undefined as any
    } as Result<ReversalValidationResult, any>;
  }

  /**
   * Get reversal preview (what the reversal journal would look like)
   */
  async getReversalPreview(
    journalId: JournalId,
    organizationId: OrganizationId,
    reversalDate: Date,
    reversalDescription?: string
  ): Promise<Result<ReversalPreview, any>> {
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
      } as Result<ReversalPreview, any>;
    }

    const journal = journalResult.value;

    // Generate reversal journal number
    const reversalJournalNumber = `${journal.journalNumber}-REV`;
    const description = reversalDescription || `REVERSAL: ${journal.description}`;

    // Create preview lines (flip debit/credit)
    const previewLines = journal.lines.map(line => ({
      accountId: line.accountId,
      description: `REVERSAL: ${line.description}`,
      debitAmount: line.creditAmount, // Flip
      creditAmount: line.debitAmount, // Flip
      originalAmount: line.originalAmount,
      exchangeRate: line.exchangeRate,
      taxCode: line.taxCode,
      taxAmount: line.taxAmount,
      taxRate: line.taxRate
    }));

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        originalJournalNumber: journal.journalNumber,
        reversalJournalNumber,
        description,
        reversalDate,
        currency: journal.currency,
        totalDebit: journal.getTotalCredit(), // Flipped
        totalCredit: journal.getTotalDebit(), // Flipped
        lines: previewLines,
        originalPostingDate: journal.postingDate,
        canReverse: journal.status === 'posted' && !journal.reversalJournalId
      },
      error: undefined as any
    } as Result<ReversalPreview, any>;
  }
}

export interface ReverseJournalCommand {
  readonly originalJournalId: JournalId;
  readonly organizationId: OrganizationId;
  readonly reversalDate: Date;
  readonly description?: string; // Optional custom description
  readonly auditContext: AuditContext;
}

export interface ReverseJournalResponse {
  readonly originalJournal: Journal;
  readonly reversalJournal: Journal;
  readonly originalJournalId: any;
  readonly reversalJournalId: any;
  readonly originalJournalNumber: string;
  readonly reversalJournalNumber: string;
  readonly reversalDate: Date;
  readonly reversalDescription: string;
  readonly reversedBy: UserId;
  readonly totalReversedAmount: any;
  readonly originalPostingDate: Date;
  readonly reversalPostingDate: Date;
}

export interface ReversalValidationResult {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly journal: Journal;
  readonly canReverse: boolean;
}

export interface ReversalPreview {
  readonly originalJournalNumber: string;
  readonly reversalJournalNumber: string;
  readonly description: string;
  readonly reversalDate: Date;
  readonly currency: string;
  readonly totalDebit: any;
  readonly totalCredit: any;
  readonly lines: any[];
  readonly originalPostingDate: Date;
  readonly canReverse: boolean;
}

interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly details?: any;
}