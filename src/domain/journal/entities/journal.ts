import { 
  JournalId, 
  OrganizationId, 
  PeriodId, 
  UserId, 
  JournalStatus,
  Currency,
  domainError,
  DomainErrorCodes
} from '../../shared/types';
import { Result, success, failure } from '../../shared/result';
import { Money } from '../value-objects/money';
import { JournalHash } from '../value-objects/journal-hash';
import { JournalLine } from './journal-line';

/**
 * Journal aggregate root representing an immutable accounting entry
 */
export class Journal {
  private constructor(
    public readonly id: JournalId,
    public readonly organizationId: OrganizationId,
    public readonly periodId: PeriodId,
    public readonly journalNumber: string,
    public readonly description: string,
    public readonly reference: string | undefined,
    public readonly postingDate: Date,
    public readonly status: JournalStatus,
    public readonly currency: Currency,
    public readonly lines: readonly JournalLine[],
    public readonly hashPrev: JournalHash | undefined,
    public readonly hashSelf: JournalHash | undefined,
    public readonly reversalJournalId: JournalId | undefined,
    public readonly originalJournalId: JournalId | undefined,
    public readonly extUid: string | undefined,
    public readonly createdBy: UserId,
    public readonly postedBy: UserId | undefined,
    public readonly postedAt: Date | undefined,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Create a new draft journal
   */
  static create(props: CreateJournalProps): Result<Journal, any> {
    // Validate required fields
    if (!props.description.trim()) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Journal description is required'
      ));
    }

    if (!props.journalNumber.trim()) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Journal number is required'
      ));
    }

    if (props.lines.length === 0) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Journal must have at least one line'
      ));
    }

    // Validate that all lines have the same currency
    const journalCurrency = props.currency;
    const invalidCurrencyLines = props.lines.filter(
      line => line.debitAmount.currency !== journalCurrency || 
              line.creditAmount.currency !== journalCurrency
    );

    if (invalidCurrencyLines.length > 0) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'All journal lines must use the same currency as the journal'
      ));
    }

    const now = new Date();

    const journal = new Journal(
      props.id,
      props.organizationId,
      props.periodId,
      props.journalNumber,
      props.description,
      props.reference,
      props.postingDate,
      'draft',
      props.currency,
      props.lines,
      undefined, // No hash for draft
      undefined,
      undefined,
      undefined,
      props.extUid,
      props.createdBy,
      undefined,
      undefined,
      now,
      now
    );

    // Validate business rules
    const validation = journal.validateBusinessRules();
    if (validation.isFailure()) {
      return failure(validation.error);
    }

    return success(journal);
  }

  /**
   * Post the journal (make it immutable)
   */
  post(
    postedBy: UserId,
    previousHash?: JournalHash
  ): Result<Journal, any> {
    if (this.status !== 'draft') {
      return failure(domainError(
        DomainErrorCodes.JOURNAL_ALREADY_POSTED,
        'Journal is already posted or reversed'
      ));
    }

    // Validate business rules before posting
    const validation = this.validateBusinessRules();
    if (validation.isFailure()) {
      return failure(validation.error);
    }

    // Generate hash for immutability
    const hashData = this.toHashData();
    const hashSelf = JournalHash.generateWithPrevious(hashData, previousHash);

    const now = new Date();

    const postedJournal = new Journal(
      this.id,
      this.organizationId,
      this.periodId,
      this.journalNumber,
      this.description,
      this.reference,
      this.postingDate,
      'posted',
      this.currency,
      this.lines,
      previousHash,
      hashSelf,
      this.reversalJournalId,
      this.originalJournalId,
      this.extUid,
      this.createdBy,
      postedBy,
      now,
      this.createdAt,
      now
    );

    return success(postedJournal);
  }

  /**
   * Create a reversal journal
   */
  createReversal(
    reversalJournalId: JournalId,
    reversalDescription: string,
    reversalDate: Date,
    createdBy: UserId
  ): Result<Journal, any> {
    if (this.status !== 'posted') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only posted journals can be reversed'
      ));
    }

    // Create reversed lines (flip debit/credit)
    const reversedLines = this.lines.map(line => 
      line.update({
        debitAmount: line.creditAmount,
        creditAmount: line.debitAmount,
        description: `REVERSAL: ${line.description}`
      })
    );

    const reversalProps: CreateJournalProps = {
      id: reversalJournalId,
      organizationId: this.organizationId,
      periodId: this.periodId,
      journalNumber: `${this.journalNumber}-REV`,
      description: reversalDescription,
      reference: `REV-${this.reference || this.journalNumber}`,
      postingDate: reversalDate,
      currency: this.currency,
      lines: reversedLines,
      originalJournalId: this.id,
      createdBy,
    };

    // Mark original as reversed
    const reversedOriginal = new Journal(
      this.id,
      this.organizationId,
      this.periodId,
      this.journalNumber,
      this.description,
      this.reference,
      this.postingDate,
      'reversed',
      this.currency,
      this.lines,
      this.hashPrev,
      this.hashSelf,
      reversalJournalId,
      this.originalJournalId,
      this.extUid,
      this.createdBy,
      this.postedBy,
      this.postedAt,
      this.createdAt,
      new Date()
    );

    const reversalJournal = Journal.create(reversalProps);
    if (reversalJournal.isFailure()) {
      return reversalJournal;
    }

    return success(reversalJournal.value);
  }

  /**
   * Update draft journal
   */
  update(updates: UpdateJournalProps): Result<Journal, any> {
    if (this.status !== 'draft') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only draft journals can be updated'
      ));
    }

    const updatedJournal = new Journal(
      this.id,
      this.organizationId,
      this.periodId,
      updates.journalNumber ?? this.journalNumber,
      updates.description ?? this.description,
      updates.reference ?? this.reference,
      updates.postingDate ?? this.postingDate,
      this.status,
      updates.currency ?? this.currency,
      updates.lines ?? this.lines,
      this.hashPrev,
      this.hashSelf,
      this.reversalJournalId,
      this.originalJournalId,
      updates.extUid ?? this.extUid,
      this.createdBy,
      this.postedBy,
      this.postedAt,
      this.createdAt,
      new Date()
    );

    // Validate updated journal
    const validation = updatedJournal.validateBusinessRules();
    if (validation.isFailure()) {
      return failure(validation.error);
    }

    return success(updatedJournal);
  }

  /**
   * Calculate total debit amount
   */
  getTotalDebit(): Money {
    return this.lines.reduce(
      (total, line) => total.add(line.debitAmount),
      Money.zero(this.currency)
    );
  }

  /**
   * Calculate total credit amount
   */
  getTotalCredit(): Money {
    return this.lines.reduce(
      (total, line) => total.add(line.creditAmount),
      Money.zero(this.currency)
    );
  }

  /**
   * Check if journal is balanced
   */
  isBalanced(): boolean {
    const totalDebit = this.getTotalDebit();
    const totalCredit = this.getTotalCredit();
    return totalDebit.equals(totalCredit);
  }

  /**
   * Check if journal is immutable
   */
  isImmutable(): boolean {
    return this.status === 'posted' || this.status === 'reversed';
  }

  /**
   * Validate all business rules
   */
  private validateBusinessRules(): Result<void, any> {
    // Check if balanced
    if (!this.isBalanced()) {
      return failure(domainError(
        DomainErrorCodes.UNBALANCED_JOURNAL,
        'Journal debits must equal credits',
        {
          totalDebit: this.getTotalDebit().toString(),
          totalCredit: this.getTotalCredit().toString()
        }
      ));
    }

    // Validate line numbers are sequential
    const lineNumbers = this.lines.map(line => line.lineNumber).sort((a, b) => a - b);
    for (let i = 0; i < lineNumbers.length; i++) {
      if (lineNumbers[i] !== i + 1) {
        return failure(domainError(
          DomainErrorCodes.VALIDATION_FAILED,
          'Journal line numbers must be sequential starting from 1'
        ));
      }
    }

    // Validate exchange rate calculations for each line
    for (const line of this.lines) {
      if (!line.validateExchangeCalculation()) {
        return failure(domainError(
          DomainErrorCodes.VALIDATION_FAILED,
          `Invalid exchange rate calculation for line ${line.lineNumber}`
        ));
      }
    }

    return success(undefined);
  }

  /**
   * Convert to hash data format
   */
  private toHashData() {
    return {
      organizationId: this.organizationId,
      periodId: this.periodId,
      journalNumber: this.journalNumber,
      description: this.description,
      reference: this.reference,
      postingDate: this.postingDate,
      totalDebit: this.getTotalDebit().amount,
      totalCredit: this.getTotalCredit().amount,
      currency: this.currency,
      hashPrev: this.hashPrev?.value,
      lines: this.lines.map(line => line.toHashData())
    };
  }
}

export interface CreateJournalProps {
  readonly id: JournalId;
  readonly organizationId: OrganizationId;
  readonly periodId: PeriodId;
  readonly journalNumber: string;
  readonly description: string;
  readonly reference?: string;
  readonly postingDate: Date;
  readonly currency: Currency;
  readonly lines: readonly JournalLine[];
  readonly originalJournalId?: JournalId;
  readonly extUid?: string;
  readonly createdBy: UserId;
}

export interface UpdateJournalProps {
  readonly journalNumber?: string;
  readonly description?: string;
  readonly reference?: string;
  readonly postingDate?: Date;
  readonly currency?: Currency;
  readonly lines?: readonly JournalLine[];
  readonly extUid?: string;
}