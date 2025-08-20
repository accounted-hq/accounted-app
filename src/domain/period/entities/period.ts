import { 
  PeriodId, 
  OrganizationId, 
  PeriodStatus,
  domainError,
  DomainErrorCodes
} from '../../shared/types';
import { Result, success, failure } from '../../shared/result';

/**
 * Period entity representing an accounting period
 */
export class Period {
  private constructor(
    public readonly id: PeriodId,
    public readonly organizationId: OrganizationId,
    public readonly name: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly status: PeriodStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Create a new period
   */
  static create(props: CreatePeriodProps): Result<Period, any> {
    // Validate required fields
    if (!props.name.trim()) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Period name is required'
      ));
    }

    // Validate date range
    if (props.startDate >= props.endDate) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Period start date must be before end date'
      ));
    }

    // Check for reasonable period length (max 2 years)
    const maxDuration = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years in milliseconds
    if (props.endDate.getTime() - props.startDate.getTime() > maxDuration) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Period duration cannot exceed 2 years'
      ));
    }

    const now = new Date();

    const period = new Period(
      props.id,
      props.organizationId,
      props.name,
      props.startDate,
      props.endDate,
      'open', // New periods start as open
      now,
      now
    );

    return success(period);
  }

  /**
   * Check if a date falls within this period
   */
  containsDate(date: Date): boolean {
    return date >= this.startDate && date <= this.endDate;
  }

  /**
   * Check if this period is open for posting
   */
  isOpen(): boolean {
    return this.status === 'open';
  }

  /**
   * Check if this period is in closing state
   */
  isClosing(): boolean {
    return this.status === 'closing';
  }

  /**
   * Check if this period is closed
   */
  isClosed(): boolean {
    return this.status === 'closed';
  }

  /**
   * Check if postings are allowed
   */
  allowsPosting(): boolean {
    return this.status === 'open';
  }

  /**
   * Start closing process
   */
  startClosing(): Result<Period, any> {
    if (this.status !== 'open') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only open periods can be set to closing'
      ));
    }

    return success(new Period(
      this.id,
      this.organizationId,
      this.name,
      this.startDate,
      this.endDate,
      'closing',
      this.createdAt,
      new Date()
    ));
  }

  /**
   * Close the period permanently
   */
  close(): Result<Period, any> {
    if (this.status !== 'closing') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only closing periods can be closed'
      ));
    }

    return success(new Period(
      this.id,
      this.organizationId,
      this.name,
      this.startDate,
      this.endDate,
      'closed',
      this.createdAt,
      new Date()
    ));
  }

  /**
   * Reopen a closing period
   */
  reopen(): Result<Period, any> {
    if (this.status !== 'closing') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only closing periods can be reopened'
      ));
    }

    return success(new Period(
      this.id,
      this.organizationId,
      this.name,
      this.startDate,
      this.endDate,
      'open',
      this.createdAt,
      new Date()
    ));
  }

  /**
   * Check if this period overlaps with another period
   */
  overlapsWith(other: Period): boolean {
    return this.startDate < other.endDate && other.startDate < this.endDate;
  }

  /**
   * Get period duration in days
   */
  getDurationDays(): number {
    const diffTime = this.endDate.getTime() - this.startDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if this is a current period (contains today)
   */
  isCurrent(): boolean {
    const today = new Date();
    return this.containsDate(today);
  }

  /**
   * Update period properties
   */
  update(updates: UpdatePeriodProps): Result<Period, any> {
    // Only allow updates to open periods
    if (this.status !== 'open') {
      return failure(domainError(
        DomainErrorCodes.BUSINESS_RULE_VIOLATION,
        'Only open periods can be updated'
      ));
    }

    const updatedStartDate = updates.startDate ?? this.startDate;
    const updatedEndDate = updates.endDate ?? this.endDate;
    const updatedName = updates.name ?? this.name;

    // Validate updated date range
    if (updatedStartDate >= updatedEndDate) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Period start date must be before end date'
      ));
    }

    // Validate name
    if (!updatedName.trim()) {
      return failure(domainError(
        DomainErrorCodes.VALIDATION_FAILED,
        'Period name is required'
      ));
    }

    const updatedPeriod = new Period(
      this.id,
      this.organizationId,
      updatedName,
      updatedStartDate,
      updatedEndDate,
      this.status,
      this.createdAt,
      new Date()
    );

    return success(updatedPeriod);
  }
}

export interface CreatePeriodProps {
  readonly id: PeriodId;
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
}

export interface UpdatePeriodProps {
  readonly name?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
}