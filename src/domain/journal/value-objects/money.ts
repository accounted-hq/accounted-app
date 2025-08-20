import { Decimal } from 'decimal.js';
import { Currency, Amount, amount, currency } from '../../shared/types';

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding
  toExpNeg: -7,
  toExpPos: 21,
});

/**
 * Money value object representing an amount with currency
 * Uses Decimal.js for precise financial calculations
 */
export class Money {
  private readonly _decimal: Decimal;

  private constructor(
    public readonly amount: Amount,
    public readonly currency: Currency,
    decimal: Decimal
  ) {
    this._decimal = decimal;
  }

  /**
   * Create Money from decimal string and currency
   */
  static create(amountValue: string | number, currencyCode: string): Money {
    let decimal: Decimal;
    
    try {
      decimal = new Decimal(amountValue);
    } catch (error) {
      throw new Error(`Invalid amount value: ${amountValue}`);
    }

    // Validate decimal precision (max 4 decimal places for accounting)
    if (decimal.decimalPlaces() > 4) {
      throw new Error(`Amount exceeds maximum 4 decimal places: ${amountValue}`);
    }

    // Validate currency (ISO 4217 - 3 characters)
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error(`Invalid currency code: ${currencyCode}`);
    }

    // Format with 4 decimal places for storage
    const formattedAmount = decimal.toFixed(4);
    return new Money(amount(formattedAmount), currency(currencyCode), decimal);
  }

  /**
   * Common currency shortcuts
   */
  static EUR(amountValue: string | number): Money {
    return Money.create(amountValue, 'EUR');
  }

  static USD(amountValue: string | number): Money {
    return Money.create(amountValue, 'USD');
  }

  static GBP(amountValue: string | number): Money {
    return Money.create(amountValue, 'GBP');
  }

  /**
   * Zero amount in given currency
   */
  static zero(currencyCode: string): Money {
    return Money.create(0, currencyCode);
  }

  /**
   * Check if this is zero amount
   */
  isZero(): boolean {
    return this._decimal.isZero();
  }

  /**
   * Check if this is positive amount
   */
  isPositive(): boolean {
    return this._decimal.isPositive();
  }

  /**
   * Check if this is negative amount
   */
  isNegative(): boolean {
    return this._decimal.isNegative();
  }

  /**
   * Add another money amount (must be same currency)
   */
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot add different currencies: ${this.currency} and ${other.currency}`);
    }

    const sum = this._decimal.add(other._decimal);
    return new Money(amount(sum.toFixed(4)), this.currency, sum);
  }

  /**
   * Subtract another money amount (must be same currency)
   */
  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot subtract different currencies: ${this.currency} and ${other.currency}`);
    }

    const difference = this._decimal.sub(other._decimal);
    return new Money(amount(difference.toFixed(4)), this.currency, difference);
  }

  /**
   * Multiply by a number or Decimal
   */
  multiply(factor: number | string | Decimal): Money {
    const multiplier = factor instanceof Decimal ? factor : new Decimal(factor);
    const product = this._decimal.mul(multiplier);
    return new Money(amount(product.toFixed(4)), this.currency, product);
  }

  /**
   * Divide by a number or Decimal
   */
  divide(divisor: number | string | Decimal): Money {
    const div = divisor instanceof Decimal ? divisor : new Decimal(divisor);
    if (div.isZero()) {
      throw new Error('Cannot divide by zero');
    }
    const quotient = this._decimal.div(div);
    return new Money(amount(quotient.toFixed(4)), this.currency, quotient);
  }

  /**
   * Negate the amount
   */
  negate(): Money {
    const negated = this._decimal.neg();
    return new Money(amount(negated.toFixed(4)), this.currency, negated);
  }

  /**
   * Compare with another money amount
   */
  equals(other: Money): boolean {
    return this.currency === other.currency && this._decimal.equals(other._decimal);
  }

  /**
   * Compare magnitude (returns -1, 0, or 1)
   */
  compareTo(other: Money): number {
    if (this.currency !== other.currency) {
      throw new Error(`Cannot compare different currencies: ${this.currency} and ${other.currency}`);
    }
    return this._decimal.comparedTo(other._decimal);
  }

  /**
   * Check if greater than another amount
   */
  greaterThan(other: Money): boolean {
    return this.compareTo(other) > 0;
  }

  /**
   * Check if less than another amount
   */
  lessThan(other: Money): boolean {
    return this.compareTo(other) < 0;
  }

  /**
   * Check if same currency
   */
  hasSameCurrency(other: Money): boolean {
    return this.currency === other.currency;
  }

  /**
   * Get absolute value
   */
  abs(): Money {
    const absolute = this._decimal.abs();
    return new Money(amount(absolute.toFixed(4)), this.currency, absolute);
  }

  /**
   * Convert to Decimal for advanced calculations
   */
  toDecimal(): Decimal {
    return this._decimal;
  }

  /**
   * Convert to number (use carefully - potential precision loss)
   */
  toNumber(): number {
    return this._decimal.toNumber();
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this.amount} ${this.currency}`;
  }

  /**
   * Format for display
   */
  format(locale: string = 'en-US'): string {
    const num = parseFloat(this.amount);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  }
}