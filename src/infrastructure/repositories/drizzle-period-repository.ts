import { and, eq, gte, lte, desc, or, ne } from 'drizzle-orm';
import { db } from '../../db/connection';
import { periods } from '../../db/schema';
import { withOrganizationContext, OrganizationContext } from '../../db/utils';
import { 
  OrganizationId, 
  PeriodId, 
  organizationId, 
  periodId,
  PeriodStatus
} from '../../domain/shared/types';
import { Result, success, failure, asyncResult } from '../../domain/shared/result';
import { Period, CreatePeriodProps } from '../../domain/period/entities/period';
import { PeriodRepository } from '../../domain/period/repositories/period-repository';

/**
 * Drizzle implementation of PeriodRepository
 */
export class DrizzlePeriodRepository implements PeriodRepository {
  /**
   * Find period by ID
   */
  async findById(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Period | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const rows = await db
          .select()
          .from(periods)
          .where(
            and(
              eq(periods.id, periodId),
              eq(periods.organizationId, organizationId)
            )
          )
          .limit(1);

        if (rows.length === 0) {
          return null;
        }

        return this.mapRowToPeriod(rows[0]);
      });
    });
  }

  /**
   * Find all periods for an organization
   */
  async findByOrganization(organizationId: OrganizationId): Promise<Result<Period[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const rows = await db
          .select()
          .from(periods)
          .where(eq(periods.organizationId, organizationId))
          .orderBy(desc(periods.startDate));

        return rows.map(row => this.mapRowToPeriod(row));
      });
    });
  }

  /**
   * Find period that contains a specific date
   */
  async findByDate(
    date: Date, 
    organizationId: OrganizationId
  ): Promise<Result<Period | null, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const rows = await db
          .select()
          .from(periods)
          .where(
            and(
              eq(periods.organizationId, organizationId),
              lte(periods.startDate, date),
              gte(periods.endDate, date)
            )
          )
          .limit(1);

        if (rows.length === 0) {
          return null;
        }

        return this.mapRowToPeriod(rows[0]);
      });
    });
  }

  /**
   * Find open periods for an organization
   */
  async findOpenPeriods(organizationId: OrganizationId): Promise<Result<Period[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const rows = await db
          .select()
          .from(periods)
          .where(
            and(
              eq(periods.organizationId, organizationId),
              eq(periods.status, 'open')
            )
          )
          .orderBy(desc(periods.startDate));

        return rows.map(row => this.mapRowToPeriod(row));
      });
    });
  }

  /**
   * Find periods that overlap with given date range
   */
  async findOverlappingPeriods(
    startDate: Date,
    endDate: Date,
    organizationId: OrganizationId,
    excludePeriodId?: PeriodId
  ): Promise<Result<Period[], any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        const conditions = [
          eq(periods.organizationId, organizationId),
          // Periods overlap if: startDate < other.endDate AND endDate > other.startDate
          and(
            lte(periods.startDate, endDate),
            gte(periods.endDate, startDate)
          )
        ];

        // Exclude specific period if provided
        if (excludePeriodId) {
          conditions.push(ne(periods.id, excludePeriodId));
        }

        const rows = await db
          .select()
          .from(periods)
          .where(and(...conditions))
          .orderBy(periods.startDate);

        return rows.map(row => this.mapRowToPeriod(row));
      });
    });
  }

  /**
   * Save period (insert or update)
   */
  async save(period: Period): Promise<Result<Period, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId: period.organizationId };
      
      return await withOrganizationContext(context, async () => {
        const periodData = {
          id: period.id,
          organizationId: period.organizationId,
          name: period.name,
          startDate: period.startDate,
          endDate: period.endDate,
          status: period.status,
          createdAt: period.createdAt,
          updatedAt: period.updatedAt
        };

        // Try to update first
        const updateResult = await db
          .update(periods)
          .set({
            name: periodData.name,
            startDate: periodData.startDate,
            endDate: periodData.endDate,
            status: periodData.status,
            updatedAt: periodData.updatedAt
          })
          .where(
            and(
              eq(periods.id, periodData.id),
              eq(periods.organizationId, periodData.organizationId)
            )
          )
          .returning();

        if (updateResult.length > 0) {
          return this.mapRowToPeriod(updateResult[0]);
        }

        // If update didn't affect any rows, insert
        const insertResult = await db
          .insert(periods)
          .values(periodData)
          .returning();

        return this.mapRowToPeriod(insertResult[0]);
      });
    });
  }

  /**
   * Delete period (only if no journals exist)
   */
  async delete(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<void, any>> {
    return asyncResult(async () => {
      const context: OrganizationContext = { organizationId };
      
      return await withOrganizationContext(context, async () => {
        // TODO: Add check for existing journals in this period
        // This would require a journal repository dependency or a direct query
        
        await db
          .delete(periods)
          .where(
            and(
              eq(periods.id, periodId),
              eq(periods.organizationId, organizationId)
            )
          );

        return undefined;
      });
    });
  }

  /**
   * Map database row to Period entity
   */
  private mapRowToPeriod(row: any): Period {
    // We need to use the Period.create method but bypass validation for database rows
    // In a real implementation, we might add a fromDatabase static method to Period
    const periodResult = Period.create({
      id: periodId(row.id),
      organizationId: organizationId(row.organizationId),
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate
    });

    if (periodResult.isFailure()) {
      throw new Error(`Invalid period data from database: ${periodResult.error.message}`);
    }

    // Create a new period with the correct status from database
    return new (Period as any)(
      periodId(row.id),
      organizationId(row.organizationId),
      row.name,
      row.startDate,
      row.endDate,
      row.status as PeriodStatus,
      row.createdAt,
      row.updatedAt
    );
  }
}