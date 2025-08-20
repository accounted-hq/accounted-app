import { createHash } from 'crypto';
import { Hash, hash } from '../../shared/types';

/**
 * Journal hash value object for implementing hash chaining
 * Ensures immutability and integrity of journal entries
 */
export class JournalHash {
  private constructor(public readonly value: Hash) {}

  /**
   * Create hash from string value
   */
  static fromString(value: string): JournalHash {
    if (!/^[a-f0-9]{64}$/.test(value)) {
      throw new Error(`Invalid hash format: ${value}`);
    }
    return new JournalHash(hash(value));
  }

  /**
   * Generate hash from journal data
   */
  static generate(data: JournalHashData): JournalHash {
    const serialized = JournalHash.serialize(data);
    const hashValue = createHash('sha256').update(serialized).digest('hex');
    return new JournalHash(hash(hashValue));
  }

  /**
   * Generate hash with previous hash for chaining
   */
  static generateWithPrevious(data: JournalHashData, previousHash?: JournalHash): JournalHash {
    const dataWithPrev = {
      ...data,
      hashPrev: previousHash?.value,
    };
    return JournalHash.generate(dataWithPrev);
  }

  /**
   * Verify hash against data
   */
  verify(data: JournalHashData): boolean {
    const expected = JournalHash.generate(data);
    return this.value === expected.value;
  }

  /**
   * Check if this hash equals another
   */
  equals(other: JournalHash): boolean {
    return this.value === other.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return this.value;
  }

  /**
   * Serialize journal data for hashing
   * Order matters for consistent hashing!
   */
  private static serialize(data: JournalHashData): string {
    // Create deterministic serialization
    const fields = [
      data.organizationId,
      data.periodId,
      data.journalNumber,
      data.description,
      data.reference || '',
      data.postingDate.toISOString(),
      data.totalDebit,
      data.totalCredit,
      data.currency,
      data.hashPrev || '',
      // Serialize lines in deterministic order
      data.lines
        .slice()
        .sort((a, b) => a.lineNumber - b.lineNumber)
        .map(line => [
          line.accountId,
          line.lineNumber.toString(),
          line.description,
          line.debitAmount,
          line.creditAmount,
          line.originalCurrency,
          line.originalDebitAmount,
          line.originalCreditAmount,
          line.exchangeRate,
          line.taxCode || '',
          line.taxAmount || '0',
          line.taxRate || '0',
        ].join('|'))
        .join(';'),
    ];

    return fields.join(':');
  }
}

/**
 * Data structure for hashing journal entries
 */
export interface JournalHashData {
  readonly organizationId: string;
  readonly periodId: string;
  readonly journalNumber: string;
  readonly description: string;
  readonly reference?: string;
  readonly postingDate: Date;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly currency: string;
  readonly hashPrev?: string;
  readonly lines: readonly JournalLineHashData[];
}

export interface JournalLineHashData {
  readonly accountId: string;
  readonly lineNumber: number;
  readonly description: string;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly originalCurrency: string;
  readonly originalDebitAmount: string;
  readonly originalCreditAmount: string;
  readonly exchangeRate: string;
  readonly taxCode?: string;
  readonly taxAmount?: string;
  readonly taxRate?: string;
}