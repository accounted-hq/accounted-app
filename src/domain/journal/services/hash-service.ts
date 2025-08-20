import { OrganizationId, domainError, DomainErrorCodes } from '../../shared/types';
import { Result, success, failure } from '../../shared/result';
import { Journal } from '../entities/journal';
import { JournalHash } from '../value-objects/journal-hash';
import { JournalRepository } from '../repositories/journal-repository';

/**
 * Hash service for managing journal hash chaining
 */
export class HashService {
  constructor(private readonly journalRepository: JournalRepository) {}

  /**
   * Get the previous hash for a new journal posting
   */
  async getPreviousHash(organizationId: OrganizationId): Promise<Result<JournalHash | undefined, any>> {
    const lastJournalResult = await this.journalRepository.findLastPostedJournal(organizationId);
    
    if (lastJournalResult.isFailure()) {
      return failure(lastJournalResult.error);
    }

    const lastJournal = lastJournalResult.value;
    if (!lastJournal) {
      // First journal in the organization - no previous hash
      return success(undefined);
    }

    if (!lastJournal.hashSelf) {
      return failure(domainError(
        DomainErrorCodes.INVALID_HASH_CHAIN,
        'Last posted journal missing hash',
        { journalId: lastJournal.id }
      ));
    }

    return success(lastJournal.hashSelf);
  }

  /**
   * Verify the hash chain integrity for a journal
   */
  async verifyHashChain(journal: Journal): Promise<Result<boolean, any>> {
    if (!journal.hashSelf) {
      return failure(domainError(
        DomainErrorCodes.INVALID_HASH_CHAIN,
        'Journal missing self hash'
      ));
    }

    // Generate expected hash from journal data
    const hashData = this.createHashDataFromJournal(journal);
    const isValid = journal.hashSelf.verify(hashData);

    if (!isValid) {
      return failure(domainError(
        DomainErrorCodes.INVALID_HASH_CHAIN,
        'Journal hash verification failed',
        { journalId: journal.id }
      ));
    }

    return success(true);
  }

  /**
   * Verify the entire hash chain for an organization
   */
  async verifyOrganizationHashChain(organizationId: OrganizationId): Promise<Result<HashChainVerificationResult, any>> {
    const journalsResult = await this.journalRepository.findPostedJournalsChronological(organizationId);
    
    if (journalsResult.isFailure()) {
      return failure(journalsResult.error);
    }

    const journals = journalsResult.value;
    if (journals.length === 0) {
      return success({
        isValid: true,
        totalJournals: 0,
        invalidJournals: [],
        brokenChainAt: null
      });
    }

    const invalidJournals: string[] = [];
    let previousHash: JournalHash | undefined;

    for (let i = 0; i < journals.length; i++) {
      const journal = journals[i];

      // Verify individual journal hash
      const verificationResult = await this.verifyHashChain(journal);
      if (verificationResult.isFailure()) {
        invalidJournals.push(journal.id);
        continue;
      }

      // Verify chain linkage
      if (i === 0) {
        // First journal should have no previous hash
        if (journal.hashPrev) {
          return success({
            isValid: false,
            totalJournals: journals.length,
            invalidJournals,
            brokenChainAt: journal.id
          });
        }
      } else {
        // Subsequent journals should link to previous
        if (!journal.hashPrev || !previousHash || !journal.hashPrev.equals(previousHash)) {
          return success({
            isValid: false,
            totalJournals: journals.length,
            invalidJournals,
            brokenChainAt: journal.id
          });
        }
      }

      previousHash = journal.hashSelf;
    }

    return success({
      isValid: invalidJournals.length === 0,
      totalJournals: journals.length,
      invalidJournals,
      brokenChainAt: null
    });
  }

  /**
   * Generate hash for a journal being posted
   */
  generateJournalHash(journal: Journal, previousHash?: JournalHash): JournalHash {
    const hashData = this.createHashDataFromJournal(journal);
    return JournalHash.generateWithPrevious(hashData, previousHash);
  }

  /**
   * Create hash data from journal entity
   */
  private createHashDataFromJournal(journal: Journal) {
    return {
      organizationId: journal.organizationId,
      periodId: journal.periodId,
      journalNumber: journal.journalNumber,
      description: journal.description,
      reference: journal.reference,
      postingDate: journal.postingDate,
      totalDebit: journal.getTotalDebit().amount,
      totalCredit: journal.getTotalCredit().amount,
      currency: journal.currency,
      hashPrev: journal.hashPrev?.value,
      lines: journal.lines.map(line => line.toHashData())
    };
  }

  /**
   * Detect potential hash chain corruption
   */
  async detectHashChainIssues(organizationId: OrganizationId): Promise<Result<HashChainIssue[], any>> {
    const verificationResult = await this.verifyOrganizationHashChain(organizationId);
    
    if (verificationResult.isFailure()) {
      return failure(verificationResult.error);
    }

    const result = verificationResult.value;
    const issues: HashChainIssue[] = [];

    if (!result.isValid) {
      if (result.brokenChainAt) {
        issues.push({
          type: 'BROKEN_CHAIN',
          journalId: result.brokenChainAt,
          description: 'Hash chain is broken at this journal'
        });
      }

      result.invalidJournals.forEach(journalId => {
        issues.push({
          type: 'INVALID_HASH',
          journalId,
          description: 'Journal hash verification failed'
        });
      });
    }

    return success(issues);
  }
}

export interface HashChainVerificationResult {
  readonly isValid: boolean;
  readonly totalJournals: number;
  readonly invalidJournals: string[];
  readonly brokenChainAt: string | null;
}

export interface HashChainIssue {
  readonly type: 'BROKEN_CHAIN' | 'INVALID_HASH';
  readonly journalId: string;
  readonly description: string;
}