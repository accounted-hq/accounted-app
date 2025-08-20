import { and, eq, desc, asc, like, gte, lte, or, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/connection';
import { journals, journalLines } from '../../db/schema';
import { withOrganizationContext, OrganizationContext } from '../../db/utils';
import { 
  OrganizationId, 
  JournalId, 
  PeriodId,
  AccountId,
  UserId,
  JournalStatus,
  Currency,
  organizationId, 
  journalId,
  periodId,
  accountId,
  userId,
  currency
} from '../../domain/shared/types';
import { Result, success, failure, asyncResult } from '../../domain/shared/result';
import { Journal, CreateJournalProps } from '../../domain/journal/entities/journal';
import { JournalLine } from '../../domain/journal/entities/journal-line';
import { Money } from '../../domain/journal/value-objects/money';
import { JournalHash } from '../../domain/journal/value-objects/journal-hash';
import { JournalRepository, JournalQueryOptions } from '../../domain/journal/repositories/journal-repository';

/**
 * Drizzle implementation of JournalRepository
 */
export class DrizzleJournalRepository implements JournalRepository {
  /**
   * Find journal by ID with all lines
   */
  async findById(
    journalId: JournalId, 
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        // Get journal
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.id, journalId),
              eq(journals.organizationId, organizationId)
            )
          )
          .limit(1);

        if (journalRows.length === 0) {
          return null;
        }

        // Get journal lines
        const lineRows = await db
          .select()
          .from(journalLines)
          .where(
            and(
              eq(journalLines.journalId, journalId),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber));

        return this.mapRowsToJournal(journalRows[0], lineRows);
      });
    });
  }

  /**
   * Find journal by external UID
   */
  async findByExtUid(
    extUid: string, 
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.extUid, extUid),
              eq(journals.organizationId, organizationId)
            )
          )
          .limit(1);

        if (journalRows.length === 0) {
          return null;
        }

        const lineRows = await db
          .select()
          .from(journalLines)
          .where(
            and(
              eq(journalLines.journalId, journalRows[0].id),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber));

        return this.mapRowsToJournal(journalRows[0], lineRows);
      });
    });
  }

  /**
   * Find journal by journal number
   */
  async findByJournalNumber(
    journalNumber: string, 
    organizationId: OrganizationId
  ): Promise<Result<Journal | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.journalNumber, journalNumber),
              eq(journals.organizationId, organizationId)
            )
          )
          .limit(1);

        if (journalRows.length === 0) {
          return null;
        }

        const lineRows = await db
          .select()
          .from(journalLines)
          .where(
            and(
              eq(journalLines.journalId, journalRows[0].id),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber));

        return this.mapRowsToJournal(journalRows[0], lineRows);
      });
    });
  }

  /**
   * Find all journals in a period
   */
  async findByPeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.periodId, periodId),
              eq(journals.organizationId, organizationId)
            )
          )
          .orderBy(desc(journals.postingDate), desc(journals.journalNumber));

        // Get all journal lines for these journals
        const journalIds = journalRows.map(j => j.id);
        const lineRows = journalIds.length > 0 ? await db
          .select()
          .from(journalLines)
          .where(
            and(
              inArray(journalLines.journalId, journalIds),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber)) : [];

        // Group lines by journal ID
        const linesByJournal = lineRows.reduce((acc, line) => {
          if (!acc[line.journalId]) {
            acc[line.journalId] = [];
          }
          acc[line.journalId].push(line);
          return acc;
        }, {} as Record<string, any[]>);

        return journalRows.map(journalRow => 
          this.mapRowsToJournal(journalRow, linesByJournal[journalRow.id] || [])
        );
      });
    });
  }

  /**
   * Find posted journals in chronological order for hash chaining
   */
  async findPostedJournalsChronological(
    organizationId: OrganizationId,
    limit?: number
  ): Promise<Result<Journal[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        let query = db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.organizationId, organizationId),
              eq(journals.status, 'posted')
            )
          )
          .orderBy(asc(journals.postedAt), asc(journals.journalNumber));

        if (limit) {
          query = query.limit(limit);
        }

        const journalRows = await query;

        // Get lines for these journals
        const journalIds = journalRows.map(j => j.id);
        const lineRows = journalIds.length > 0 ? await db
          .select()
          .from(journalLines)
          .where(
            and(
              inArray(journalLines.journalId, journalIds),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber)) : [];

        const linesByJournal = lineRows.reduce((acc, line) => {
          if (!acc[line.journalId]) {
            acc[line.journalId] = [];
          }
          acc[line.journalId].push(line);
          return acc;
        }, {} as Record<string, any[]>);

        return journalRows.map(journalRow => 
          this.mapRowsToJournal(journalRow, linesByJournal[journalRow.id] || [])
        );
      });
    });
  }

  /**
   * Get the last posted journal for hash chaining
   */
  async findLastPostedJournal(organizationId: OrganizationId): Promise<Result<Journal | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.organizationId, organizationId),
              eq(journals.status, 'posted')
            )
          )
          .orderBy(desc(journals.postedAt), desc(journals.journalNumber))
          .limit(1);

        if (journalRows.length === 0) {
          return null;
        }

        const lineRows = await db
          .select()
          .from(journalLines)
          .where(
            and(
              eq(journalLines.journalId, journalRows[0].id),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber));

        return this.mapRowsToJournal(journalRows[0], lineRows);
      });
    });
  }

  /**
   * Find draft journals by period
   */
  async findDraftJournalsByPeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.periodId, periodId),
              eq(journals.organizationId, organizationId),
              eq(journals.status, 'draft')
            )
          )
          .orderBy(desc(journals.createdAt));

        const journalIds = journalRows.map(j => j.id);
        const lineRows = journalIds.length > 0 ? await db
          .select()
          .from(journalLines)
          .where(
            and(
              inArray(journalLines.journalId, journalIds),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber)) : [];

        const linesByJournal = lineRows.reduce((acc, line) => {
          if (!acc[line.journalId]) {
            acc[line.journalId] = [];
          }
          acc[line.journalId].push(line);
          return acc;
        }, {} as Record<string, any[]>);

        return journalRows.map(journalRow => 
          this.mapRowsToJournal(journalRow, linesByJournal[journalRow.id] || [])
        );
      });
    });
  }

  /**
   * Find journals by date range
   */
  async findByDateRange(
    startDate: Date,
    endDate: Date,
    organizationId: OrganizationId
  ): Promise<Result<Journal[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const journalRows = await db
          .select()
          .from(journals)
          .where(
            and(
              eq(journals.organizationId, organizationId),
              gte(journals.postingDate, startDate),
              lte(journals.postingDate, endDate)
            )
          )
          .orderBy(desc(journals.postingDate), desc(journals.journalNumber));

        const journalIds = journalRows.map(j => j.id);
        const lineRows = journalIds.length > 0 ? await db
          .select()
          .from(journalLines)
          .where(
            and(
              inArray(journalLines.journalId, journalIds),
              eq(journalLines.organizationId, organizationId)
            )
          )
          .orderBy(asc(journalLines.lineNumber)) : [];

        const linesByJournal = lineRows.reduce((acc, line) => {
          if (!acc[line.journalId]) {
            acc[line.journalId] = [];
          }
          acc[line.journalId].push(line);
          return acc;
        }, {} as Record<string, any[]>);

        return journalRows.map(journalRow => 
          this.mapRowsToJournal(journalRow, linesByJournal[journalRow.id] || [])
        );
      });
    });
  }

  /**
   * Check if journal number exists
   */
  async existsByJournalNumber(
    journalNumber: string, 
    organizationId: OrganizationId
  ): Promise<Result<boolean, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(journals)
          .where(
            and(
              eq(journals.journalNumber, journalNumber),
              eq(journals.organizationId, organizationId)
            )
          );

        return result[0].count > 0;
      });
    });
  }

  /**
   * Check if external UID exists
   */
  async existsByExtUid(
    extUid: string, 
    organizationId: OrganizationId
  ): Promise<Result<boolean, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(journals)
          .where(
            and(
              eq(journals.extUid, extUid),
              eq(journals.organizationId, organizationId)
            )
          );

        return result[0].count > 0;
      });
    });
  }

  /**
   * Count draft journals in period
   */
  async countDraftJournalsInPeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<number, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(journals)
          .where(
            and(
              eq(journals.periodId, periodId),
              eq(journals.organizationId, organizationId),
              eq(journals.status, 'draft')
            )
          );

        return result[0].count;
      });
    });
  }

  /**
   * Save journal with lines (insert or update)
   */
  async save(journal: Journal): Promise<Result<Journal, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId: journal.organizationId };
      
      return await withOrganizationContext(context, async () => {
        // Use transaction to ensure consistency
        return await db.transaction(async (tx) => {
          // Prepare journal data
          const journalData = {
            id: journal.id,
            organizationId: journal.organizationId,
            periodId: journal.periodId,
            journalNumber: journal.journalNumber,
            description: journal.description,
            reference: journal.reference,
            postingDate: journal.postingDate,
            status: journal.status,
            totalDebit: journal.getTotalDebit().amount,
            totalCredit: journal.getTotalCredit().amount,
            currency: journal.currency,
            hashPrev: journal.hashPrev?.value,
            hashSelf: journal.hashSelf?.value,
            reversalJournalId: journal.reversalJournalId,
            originalJournalId: journal.originalJournalId,
            extUid: journal.extUid,
            createdBy: journal.createdBy,
            postedBy: journal.postedBy,
            postedAt: journal.postedAt,
            createdAt: journal.createdAt,
            updatedAt: journal.updatedAt
          };

          // Try to update journal first
          const updateResult = await tx
            .update(journals)
            .set({
              journalNumber: journalData.journalNumber,
              description: journalData.description,
              reference: journalData.reference,
              postingDate: journalData.postingDate,
              status: journalData.status,
              totalDebit: journalData.totalDebit,
              totalCredit: journalData.totalCredit,
              currency: journalData.currency,
              hashPrev: journalData.hashPrev,
              hashSelf: journalData.hashSelf,
              reversalJournalId: journalData.reversalJournalId,
              originalJournalId: journalData.originalJournalId,
              extUid: journalData.extUid,
              postedBy: journalData.postedBy,
              postedAt: journalData.postedAt,
              updatedAt: journalData.updatedAt
            })
            .where(
              and(
                eq(journals.id, journalData.id),
                eq(journals.organizationId, journalData.organizationId)
              )
            )
            .returning();

          let savedJournal;
          if (updateResult.length > 0) {
            savedJournal = updateResult[0];
          } else {
            // Insert new journal
            const insertResult = await tx
              .insert(journals)
              .values(journalData)
              .returning();
            savedJournal = insertResult[0];
          }

          // Delete existing lines
          await tx
            .delete(journalLines)
            .where(
              and(
                eq(journalLines.journalId, journal.id),
                eq(journalLines.organizationId, journal.organizationId)
              )
            );

          // Insert new lines
          if (journal.lines.length > 0) {
            const lineData = journal.lines.map(line => ({
              id: crypto.randomUUID(), // Generate new ID for lines
              organizationId: journal.organizationId,
              journalId: journal.id,
              accountId: line.accountId,
              lineNumber: line.lineNumber,
              description: line.description,
              debitAmount: line.debitAmount.amount,
              creditAmount: line.creditAmount.amount,
              originalCurrency: line.originalAmount.currency,
              originalDebitAmount: line.isDebit() ? line.originalAmount.amount : '0.0000',
              originalCreditAmount: line.isCredit() ? line.originalAmount.amount : '0.0000',
              exchangeRate: line.exchangeRate,
              taxCode: line.taxCode,
              taxAmount: line.taxAmount?.amount || '0.0000',
              taxRate: line.taxRate || '0.0000',
              createdAt: new Date()
            }));

            await tx.insert(journalLines).values(lineData);
          }

          // Return the saved journal by loading it fresh
          const lineRows = await tx
            .select()
            .from(journalLines)
            .where(
              and(
                eq(journalLines.journalId, savedJournal.id),
                eq(journalLines.organizationId, savedJournal.organizationId)
              )
            )
            .orderBy(asc(journalLines.lineNumber));

          return this.mapRowsToJournal(savedJournal, lineRows);
        });
      });
    });
  }

  /**
   * Save multiple journals in a transaction (for reversals)
   */
  async saveMultiple(journals: Journal[]): Promise<Result<Journal[], any>> {
    return asyncResult(async () => {
      if (journals.length === 0) {
        return [];
      }

      const context: OrganizationContext = { organizationId: journals[0].organizationId };
      
      return await withOrganizationContext(context, async () => {
        return await db.transaction(async (tx) => {
          const savedJournals: Journal[] = [];

          for (const journal of journals) {
            // This is a simplified version - in practice, we'd optimize this
            const saveResult = await this.save(journal);
            if (saveResult.isFailure()) {
              throw new Error(`Failed to save journal ${journal.id}: ${saveResult.error}`);
            }
            savedJournals.push(saveResult.value);
          }

          return savedJournals;
        });
      });
    });
  }

  /**
   * Delete draft journal
   */
  async delete(journalId: JournalId, organizationId: OrganizationId): Promise<Result<void, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        await db.transaction(async (tx) => {
          // Delete lines first (foreign key constraint)
          await tx
            .delete(journalLines)
            .where(
              and(
                eq(journalLines.journalId, journalId),
                eq(journalLines.organizationId, organizationId)
              )
            );

          // Delete journal
          await tx
            .delete(journals)
            .where(
              and(
                eq(journals.id, journalId),
                eq(journals.organizationId, organizationId),
                eq(journals.status, 'draft') // Safety check
              )
            );
        });

        return undefined;
      });
    });
  }

  /**
   * Get next available journal number
   */
  async getNextJournalNumber(
    organizationId: OrganizationId, 
    prefix?: string
  ): Promise<Result<string, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const currentYear = new Date().getFullYear();
        const basePrefix = prefix || `JRN-${currentYear}`;
        
        // Find the highest number with this prefix
        const result = await db
          .select({ 
            journalNumber: journals.journalNumber 
          })
          .from(journals)
          .where(
            and(
              eq(journals.organizationId, organizationId),
              like(journals.journalNumber, `${basePrefix}-%`)
            )
          )
          .orderBy(desc(journals.journalNumber))
          .limit(1);

        if (result.length === 0) {
          return `${basePrefix}-001`;
        }

        // Extract number from last journal
        const lastNumber = result[0].journalNumber;
        const match = lastNumber.match(/-(\d+)$/);
        
        if (!match) {
          return `${basePrefix}-001`;
        }

        const nextNumber = parseInt(match[1]) + 1;
        return `${basePrefix}-${nextNumber.toString().padStart(3, '0')}`;
      });
    });
  }

  /**
   * Map database rows to Journal entity
   */
  private mapRowsToJournal(journalRow: any, lineRows: any[]): Journal {
    // Map lines first
    const lines = lineRows.map(lineRow => {
      const debitAmount = Money.create(lineRow.debitAmount, journalRow.currency);
      const creditAmount = Money.create(lineRow.creditAmount, journalRow.currency);
      const originalAmount = Money.create(
        lineRow.originalDebitAmount !== '0.0000' ? lineRow.originalDebitAmount : lineRow.originalCreditAmount,
        lineRow.originalCurrency
      );
      const taxAmount = lineRow.taxAmount !== '0.0000' ? 
        Money.create(lineRow.taxAmount, journalRow.currency) : undefined;

      return JournalLine.create({
        journalId: journalId(lineRow.journalId),
        accountId: accountId(lineRow.accountId),
        lineNumber: lineRow.lineNumber,
        description: lineRow.description,
        debitAmount,
        creditAmount,
        originalAmount,
        exchangeRate: lineRow.exchangeRate,
        taxCode: lineRow.taxCode || undefined,
        taxAmount,
        taxRate: lineRow.taxRate !== '0.0000' ? lineRow.taxRate : undefined
      });
    });

    // Validate all lines were created successfully
    const validLines = lines.filter(lineResult => lineResult.isSuccess()).map(lineResult => lineResult.value);
    if (validLines.length !== lines.length) {
      throw new Error('Failed to map journal lines from database');
    }

    // Create journal props
    const journalProps: CreateJournalProps = {
      id: journalId(journalRow.id),
      organizationId: organizationId(journalRow.organizationId),
      periodId: periodId(journalRow.periodId),
      journalNumber: journalRow.journalNumber,
      description: journalRow.description,
      reference: journalRow.reference || undefined,
      postingDate: journalRow.postingDate,
      currency: currency(journalRow.currency),
      lines: validLines,
      originalJournalId: journalRow.originalJournalId ? journalId(journalRow.originalJournalId) : undefined,
      extUid: journalRow.extUid || undefined,
      createdBy: userId(journalRow.createdBy)
    };

    const journalResult = Journal.create(journalProps);
    if (journalResult.isFailure()) {
      throw new Error(`Invalid journal data from database: ${journalResult.error.message}`);
    }

    // Create journal with database state (status, hashes, etc.)
    const hashPrev = journalRow.hashPrev ? JournalHash.fromString(journalRow.hashPrev) : undefined;
    const hashSelf = journalRow.hashSelf ? JournalHash.fromString(journalRow.hashSelf) : undefined;

    return new (Journal as any)(
      journalId(journalRow.id),
      organizationId(journalRow.organizationId),
      periodId(journalRow.periodId),
      journalRow.journalNumber,
      journalRow.description,
      journalRow.reference || undefined,
      journalRow.postingDate,
      journalRow.status as JournalStatus,
      currency(journalRow.currency),
      validLines,
      hashPrev,
      hashSelf,
      journalRow.reversalJournalId ? journalId(journalRow.reversalJournalId) : undefined,
      journalRow.originalJournalId ? journalId(journalRow.originalJournalId) : undefined,
      journalRow.extUid || undefined,
      userId(journalRow.createdBy),
      journalRow.postedBy ? userId(journalRow.postedBy) : undefined,
      journalRow.postedAt || undefined,
      journalRow.createdAt,
      journalRow.updatedAt
    );
  }
}