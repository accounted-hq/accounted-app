import { OrganizationId, PeriodId, domainError, DomainErrorCodes } from '../../shared/types';
import { Result, success, failure } from '../../shared/result';
import { Period, CreatePeriodProps } from '../entities/period';
import { PeriodRepository } from '../repositories/period-repository';

/**
 * Period domain service for business logic
 */
export class PeriodService {
  constructor(private readonly periodRepository: PeriodRepository) {}

  /**
   * Create a new period with overlap validation
   */
  async createPeriod(props: CreatePeriodProps): Promise<Result<Period, any>> {
    // First validate the period entity
    const periodResult = Period.create(props);
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;

    // Check for overlapping periods
    const overlappingResult = await this.periodRepository.findOverlappingPeriods(
      props.startDate,
      props.endDate,
      props.organizationId
    );

    if (overlappingResult.isFailure()) {
      return failure(overlappingResult.error);
    }

    if (overlappingResult.value.length > 0) {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Period overlaps with existing periods',
        {
          overlappingPeriods: overlappingResult.value.map(p => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate
          }))
        }
      ));
    }

    // Save the period
    return await this.periodRepository.save(period);
  }

  /**
   * Find the appropriate period for a posting date
   */
  async findPeriodForPosting(
    postingDate: Date, 
    organizationId: OrganizationId
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findByDate(postingDate, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'No period found for posting date',
        { postingDate: postingDate.toISOString() }
      ));
    }

    return success(period);
  }

  /**
   * Validate that a period allows posting
   */
  async validatePeriodForPosting(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findById(periodId, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    if (!period.allowsPosting()) {
      return failure(domainError(
        DomainErrorCodes.PERIOD_CLOSED,
        'Cannot post to closed or closing period',
        { 
          periodId: period.id,
          periodStatus: period.status,
          periodName: period.name
        }
      ));
    }

    return success(period);
  }

  /**
   * Start closing a period (validate no open journals)
   */
  async startClosingPeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findById(periodId, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    // TODO: Add validation that no draft journals exist in this period
    // This would require a journal repository dependency

    const closingResult = period.startClosing();
    if (closingResult.isFailure()) {
      return closingResult;
    }

    return await this.periodRepository.save(closingResult.value);
  }

  /**
   * Close a period permanently
   */
  async closePeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findById(periodId, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    const closedResult = period.close();
    if (closedResult.isFailure()) {
      return closedResult;
    }

    return await this.periodRepository.save(closedResult.value);
  }

  /**
   * Reopen a closing period
   */
  async reopenPeriod(
    periodId: PeriodId, 
    organizationId: OrganizationId
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findById(periodId, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    const reopenResult = period.reopen();
    if (reopenResult.isFailure()) {
      return reopenResult;
    }

    return await this.periodRepository.save(reopenResult.value);
  }

  /**
   * Get all open periods for an organization
   */
  async getOpenPeriods(organizationId: OrganizationId): Promise<Result<Period[], any>> {
    return await this.periodRepository.findOpenPeriods(organizationId);
  }

  /**
   * Update period with overlap validation
   */
  async updatePeriod(
    periodId: PeriodId,
    organizationId: OrganizationId,
    updates: { name?: string; startDate?: Date; endDate?: Date }
  ): Promise<Result<Period, any>> {
    const periodResult = await this.periodRepository.findById(periodId, organizationId);
    
    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;
    if (!period) {
      return failure(domainError(
        DomainErrorCodes.ENTITY_NOT_FOUND,
        'Period not found'
      ));
    }

    const updatedResult = period.update(updates);
    if (updatedResult.isFailure()) {
      return updatedResult;
    }

    const updatedPeriod = updatedResult.value;

    // Check for overlapping periods (excluding current period)
    const overlappingResult = await this.periodRepository.findOverlappingPeriods(
      updatedPeriod.startDate,
      updatedPeriod.endDate,
      organizationId,
      periodId
    );

    if (overlappingResult.isFailure()) {
      return failure(overlappingResult.error);
    }

    if (overlappingResult.value.length > 0) {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Updated period would overlap with existing periods',
        {
          overlappingPeriods: overlappingResult.value.map(p => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate
          }))
        }
      ));
    }

    return await this.periodRepository.save(updatedPeriod);
  }
}