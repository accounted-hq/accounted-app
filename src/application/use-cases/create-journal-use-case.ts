import { 
  OrganizationId, 
  PeriodId, 
  AccountId, 
  UserId, 
  Currency,
  AuditContext
} from '../../domain/shared/types';
import { Result } from '../../domain/shared/result';
import { Journal } from '../../domain/journal/entities/journal';
import { JournalLine } from '../../domain/journal/entities/journal-line';
import { Money } from '../../domain/journal/value-objects/money';
import { JournalService } from '../../domain/journal/services/journal-service';
import { ServiceContainer } from '../../infrastructure/services/service-factory';

/**
 * Use case for creating a new draft journal entry
 */
export class CreateJournalUseCase {
  constructor(
    private readonly journalService: JournalService,
    private readonly services: ServiceContainer
  ) {}

  async execute(command: CreateJournalCommand): Promise<Result<CreateJournalResponse, any>> {
    // Generate journal ID
    const journalId = await this.generateJournalId();

    // Create journal lines
    const linesResult = this.createJournalLines(journalId, command.lines);
    if (linesResult.isFailure()) {
      return linesResult;
    }

    // Generate journal number if not provided
    let journalNumber = command.journalNumber;
    if (!journalNumber) {
      const numberResult = await this.journalService.getNextJournalNumber(
        command.organizationId,
        command.numberPrefix
      );
      if (numberResult.isFailure()) {
        return numberResult;
      }
      journalNumber = numberResult.value;
    }

    // Create the journal
    const journalResult = await this.journalService.createDraftJournal({
      id: journalId,
      organizationId: command.organizationId,
      periodId: command.periodId,
      journalNumber,
      description: command.description,
      reference: command.reference,
      postingDate: command.postingDate,
      currency: command.currency,
      lines: linesResult.value,
      extUid: command.extUid,
      createdBy: command.auditContext.userId
    });

    if (journalResult.isFailure()) {
      return journalResult;
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        journal: journalResult.value,
        journalId: journalResult.value.id,
        journalNumber: journalResult.value.journalNumber,
        status: journalResult.value.status,
        totalDebit: journalResult.value.getTotalDebit(),
        totalCredit: journalResult.value.getTotalCredit(),
        isBalanced: journalResult.value.isBalanced()
      },
      error: undefined as any
    } as Result<CreateJournalResponse, any>;
  }

  /**
   * Create journal lines from command data
   */
  private createJournalLines(
    journalId: any,
    lineCommands: CreateJournalLineCommand[]
  ): Result<JournalLine[], any> {
    const lines: JournalLine[] = [];

    for (let i = 0; i < lineCommands.length; i++) {
      const lineCommand = lineCommands[i];
      
      // Create debit/credit amounts
      const debitAmount = lineCommand.debitAmount ? 
        Money.create(lineCommand.debitAmount, lineCommand.currency) :
        Money.zero(lineCommand.currency);
      
      const creditAmount = lineCommand.creditAmount ?
        Money.create(lineCommand.creditAmount, lineCommand.currency) :
        Money.zero(lineCommand.currency);

      // Create original amount (foreign currency)
      const originalAmount = lineCommand.originalAmount ?
        Money.create(lineCommand.originalAmount.amount, lineCommand.originalAmount.currency) :
        (debitAmount.isZero() ? creditAmount : debitAmount);

      // Create tax amount if specified
      const taxAmount = lineCommand.taxAmount ?
        Money.create(lineCommand.taxAmount, lineCommand.currency) :
        undefined;

      const lineResult = JournalLine.create({
        journalId,
        accountId: lineCommand.accountId,
        lineNumber: i + 1,
        description: lineCommand.description,
        debitAmount,
        creditAmount,
        originalAmount,
        exchangeRate: lineCommand.exchangeRate || '1.0000',
        taxCode: lineCommand.taxCode,
        taxAmount,
        taxRate: lineCommand.taxRate
      });

      if (lineResult.isFailure()) {
        return lineResult;
      }

      lines.push(lineResult.value);
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: lines,
      error: undefined as any
    } as Result<JournalLine[], any>;
  }

  /**
   * Generate a new journal ID
   */
  private async generateJournalId(): Promise<any> {
    // In a real implementation, this would use a UUID generator
    return `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export interface CreateJournalCommand {
  readonly organizationId: OrganizationId;
  readonly periodId: PeriodId;
  readonly journalNumber?: string; // Auto-generated if not provided
  readonly numberPrefix?: string; // For auto-generation
  readonly description: string;
  readonly reference?: string;
  readonly postingDate: Date;
  readonly currency: Currency;
  readonly lines: CreateJournalLineCommand[];
  readonly extUid?: string; // For external system integration
  readonly auditContext: AuditContext;
}

export interface CreateJournalLineCommand {
  readonly accountId: AccountId;
  readonly description: string;
  readonly debitAmount?: string; // Decimal string
  readonly creditAmount?: string; // Decimal string
  readonly originalAmount?: {
    readonly amount: string;
    readonly currency: Currency;
  };
  readonly exchangeRate?: string; // Decimal string
  readonly taxCode?: string;
  readonly taxAmount?: string; // Decimal string
  readonly taxRate?: string; // Decimal string (e.g., "0.19" for 19%)
  readonly currency: Currency;
}

export interface CreateJournalResponse {
  readonly journal: Journal;
  readonly journalId: any;
  readonly journalNumber: string;
  readonly status: string;
  readonly totalDebit: Money;
  readonly totalCredit: Money;
  readonly isBalanced: boolean;
}