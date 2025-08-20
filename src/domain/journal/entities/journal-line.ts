import { AccountId, JournalId } from '../../shared/types';
import { Money } from '../value-objects/money';

/**
 * Journal line entity representing a single accounting entry
 */
export class JournalLine {
  private constructor(
    public readonly journalId: JournalId,
    public readonly accountId: AccountId,
    public readonly lineNumber: number,
    public readonly description: string,
    public readonly debitAmount: Money,
    public readonly creditAmount: Money,
    public readonly originalAmount: Money, // Original currency amount
    public readonly exchangeRate: string,
    public readonly taxCode?: string,
    public readonly taxAmount?: Money,
    public readonly taxRate?: string
  ) {}

  /**
   * Create a journal line
   */
  static create(props: JournalLineProps): JournalLine {
    // Validate that either debit or credit is zero (not both)
    if (props.debitAmount.isZero() && props.creditAmount.isZero()) {
      throw new Error('Journal line must have either debit or credit amount');
    }

    if (!props.debitAmount.isZero() && !props.creditAmount.isZero()) {
      throw new Error('Journal line cannot have both debit and credit amounts');
    }

    // Validate line number
    if (props.lineNumber <= 0) {
      throw new Error('Line number must be positive');
    }

    // Validate currencies match
    if (!props.debitAmount.hasSameCurrency(props.creditAmount)) {
      throw new Error('Debit and credit amounts must have same currency');
    }

    // Validate exchange rate
    const rate = parseFloat(props.exchangeRate);
    if (rate <= 0) {
      throw new Error('Exchange rate must be positive');
    }

    // Validate tax rate if provided
    if (props.taxRate) {
      const taxRate = parseFloat(props.taxRate);
      if (taxRate < 0 || taxRate > 1) {
        throw new Error('Tax rate must be between 0 and 1');
      }
    }

    return new JournalLine(
      props.journalId,
      props.accountId,
      props.lineNumber,
      props.description,
      props.debitAmount,
      props.creditAmount,
      props.originalAmount,
      props.exchangeRate,
      props.taxCode,
      props.taxAmount,
      props.taxRate
    );
  }

  /**
   * Get the net amount (debit - credit)
   */
  getNetAmount(): Money {
    return this.debitAmount.subtract(this.creditAmount);
  }

  /**
   * Check if this is a debit line
   */
  isDebit(): boolean {
    return !this.debitAmount.isZero();
  }

  /**
   * Check if this is a credit line
   */
  isCredit(): boolean {
    return !this.creditAmount.isZero();
  }

  /**
   * Get the absolute amount
   */
  getAmount(): Money {
    return this.isDebit() ? this.debitAmount : this.creditAmount;
  }

  /**
   * Check if this line has tax
   */
  hasTax(): boolean {
    return !!this.taxCode && !!this.taxAmount && !this.taxAmount.isZero();
  }

  /**
   * Calculate tax amount based on line amount and tax rate
   */
  calculateTaxAmount(taxRate: string): Money {
    const rate = parseFloat(taxRate);
    const baseAmount = this.getAmount();
    return baseAmount.multiply(rate);
  }

  /**
   * Validate that original amount converts correctly to booking amount
   */
  validateExchangeCalculation(): boolean {
    const expectedBookingAmount = this.originalAmount.multiply(this.exchangeRate);
    const actualBookingAmount = this.getAmount();
    
    // Use precise decimal comparison (allow difference up to 0.0001)
    const difference = expectedBookingAmount.subtract(actualBookingAmount).abs();
    const tolerance = Money.create('0.0001', actualBookingAmount.currency);
    
    return difference.lessThan(tolerance) || difference.equals(tolerance);
  }

  /**
   * Create a copy with updated properties
   */
  update(updates: Partial<JournalLineUpdateProps>): JournalLine {
    return new JournalLine(
      this.journalId,
      this.accountId,
      updates.lineNumber ?? this.lineNumber,
      updates.description ?? this.description,
      updates.debitAmount ?? this.debitAmount,
      updates.creditAmount ?? this.creditAmount,
      updates.originalAmount ?? this.originalAmount,
      updates.exchangeRate ?? this.exchangeRate,
      updates.taxCode ?? this.taxCode,
      updates.taxAmount ?? this.taxAmount,
      updates.taxRate ?? this.taxRate
    );
  }

  /**
   * Convert to hash data format
   */
  toHashData() {
    return {
      accountId: this.accountId,
      lineNumber: this.lineNumber,
      description: this.description,
      debitAmount: this.debitAmount.amount,
      creditAmount: this.creditAmount.amount,
      originalCurrency: this.originalAmount.currency,
      originalDebitAmount: this.isDebit() ? this.originalAmount.amount : '0.0000',
      originalCreditAmount: this.isCredit() ? this.originalAmount.amount : '0.0000',
      exchangeRate: this.exchangeRate,
      taxCode: this.taxCode,
      taxAmount: this.taxAmount?.amount || '0.0000',
      taxRate: this.taxRate || '0.0000',
    };
  }
}

export interface JournalLineProps {
  readonly journalId: JournalId;
  readonly accountId: AccountId;
  readonly lineNumber: number;
  readonly description: string;
  readonly debitAmount: Money;
  readonly creditAmount: Money;
  readonly originalAmount: Money;
  readonly exchangeRate: string;
  readonly taxCode?: string;
  readonly taxAmount?: Money;
  readonly taxRate?: string;
}

export interface JournalLineUpdateProps {
  readonly lineNumber?: number;
  readonly description?: string;
  readonly debitAmount?: Money;
  readonly creditAmount?: Money;
  readonly originalAmount?: Money;
  readonly exchangeRate?: string;
  readonly taxCode?: string;
  readonly taxAmount?: Money;
  readonly taxRate?: string;
}