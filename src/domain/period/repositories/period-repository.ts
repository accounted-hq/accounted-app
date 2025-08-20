import { OrganizationId, PeriodId } from '../../shared/types';
import { Result } from '../../shared/result';
import { Period } from '../entities/period';

/**
 * Period repository interface for data access
 */
export interface PeriodRepository {
  /**
   * Find period by ID
   */
  findById(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<Period | null, any>>;

  /**
   * Find all periods for an organization
   */
  findByOrganization(organizationId: OrganizationId): Promise<Result<Period[], any>>;

  /**
   * Find period that contains a specific date
   */
  findByDate(date: Date, organizationId: OrganizationId): Promise<Result<Period | null, any>>;

  /**
   * Find open periods for an organization
   */
  findOpenPeriods(organizationId: OrganizationId): Promise<Result<Period[], any>>;

  /**
   * Check if periods overlap with given date range
   */
  findOverlappingPeriods(
    startDate: Date, 
    endDate: Date, 
    organizationId: OrganizationId,
    excludePeriodId?: PeriodId
  ): Promise<Result<Period[], any>>;

  /**
   * Save period
   */
  save(period: Period): Promise<Result<Period, any>>;

  /**
   * Delete period (only if no journals exist)
   */
  delete(periodId: PeriodId, organizationId: OrganizationId): Promise<Result<void, any>>;
}