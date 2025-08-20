import { 
  OrganizationId, 
  PeriodId,
  AuditContext
} from '../../domain/shared/types';
import { Result } from '../../domain/shared/result';
import { Period } from '../../domain/period/entities/period';
import { PeriodService } from '../../domain/period/services/period-service';
import { ServiceContainer } from '../../infrastructure/services/service-factory';

/**
 * Use case for creating a new accounting period
 */
export class CreatePeriodUseCase {
  constructor(
    private readonly periodService: PeriodService,
    private readonly services: ServiceContainer
  ) {}

  async execute(command: CreatePeriodCommand): Promise<Result<CreatePeriodResponse, any>> {
    // Generate period ID if not provided
    const periodId = command.periodId || await this.generatePeriodId();

    // Create the period
    const periodResult = await this.periodService.createPeriod({
      id: periodId,
      organizationId: command.organizationId,
      name: command.name,
      startDate: command.startDate,
      endDate: command.endDate
    });

    if (periodResult.isFailure()) {
      return periodResult;
    }

    const period = periodResult.value;

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        period,
        periodId: period.id,
        name: period.name,
        startDate: period.startDate,
        endDate: period.endDate,
        status: period.status,
        durationDays: period.getDurationDays(),
        isCurrent: period.isCurrent(),
        createdAt: period.createdAt
      },
      error: undefined as any
    } as Result<CreatePeriodResponse, any>;
  }

  /**
   * Validate period creation with detailed checks
   */
  async validatePeriodCreation(command: CreatePeriodCommand): Promise<Result<PeriodValidationResult, any>> {
    const issues: ValidationIssue[] = [];

    // Basic validation
    if (!command.name?.trim()) {
      issues.push({
        field: 'name',
        code: 'REQUIRED',
        message: 'Period name is required'
      });
    }

    if (command.startDate >= command.endDate) {
      issues.push({
        field: 'dateRange',
        code: 'INVALID_RANGE',
        message: 'Start date must be before end date'
      });
    }

    // Check period length
    const durationMs = command.endDate.getTime() - command.startDate.getTime();
    const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    
    if (durationDays < 1) {
      issues.push({
        field: 'dateRange',
        code: 'TOO_SHORT',
        message: 'Period must be at least 1 day long'
      });
    }

    if (durationDays > 732) { // ~2 years
      issues.push({
        field: 'dateRange',
        code: 'TOO_LONG',
        message: 'Period cannot exceed 2 years'
      });
    }

    // Check for common period lengths (warn if unusual)
    const commonLengths = [
      { days: 31, name: 'Monthly' },
      { days: 92, name: 'Quarterly' },
      { days: 365, name: 'Yearly' },
      { days: 366, name: 'Leap Year' }
    ];

    const isCommonLength = commonLengths.some(length => 
      Math.abs(durationDays - length.days) <= 2
    );

    if (!isCommonLength && durationDays > 7) {
      // This is a warning, not an error
      console.warn(`Unusual period length: ${durationDays} days`);
    }

    return {
      isSuccess: () => true,
      isFailure: () => false,
      value: {
        isValid: issues.length === 0,
        issues,
        durationDays,
        suggestedName: this.suggestPeriodName(command.startDate, command.endDate)
      },
      error: undefined as any
    } as Result<PeriodValidationResult, any>;
  }

  /**
   * Get suggested period name based on dates
   */
  private suggestPeriodName(startDate: Date, endDate: Date): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const startMonth = start.getMonth();
    const endMonth = end.getMonth();

    // Same year
    if (startYear === endYear) {
      // Same month
      if (startMonth === endMonth) {
        const monthName = start.toLocaleDateString('en-US', { month: 'long' });
        return `${monthName} ${startYear}`;
      }
      
      // Quarterly periods
      const quarters = [
        { months: [0, 1, 2], name: 'Q1' },
        { months: [3, 4, 5], name: 'Q2' },
        { months: [6, 7, 8], name: 'Q3' },
        { months: [9, 10, 11], name: 'Q4' }
      ];

      for (const quarter of quarters) {
        if (quarter.months.includes(startMonth) && quarter.months.includes(endMonth)) {
          const monthSpan = endMonth - startMonth + 1;
          if (monthSpan === 3) {
            return `${startYear} ${quarter.name}`;
          }
        }
      }

      // Full year
      if (startMonth === 0 && endMonth === 11) {
        return `${startYear}`;
      }

      // Half year
      if ((startMonth === 0 && endMonth === 5) || (startMonth === 6 && endMonth === 11)) {
        const half = startMonth === 0 ? 'H1' : 'H2';
        return `${startYear} ${half}`;
      }

      // Date range within year
      return `${startYear} (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;
    }

    // Multi-year
    return `${startYear}-${endYear}`;
  }

  /**
   * Generate a new period ID
   */
  private async generatePeriodId(): Promise<PeriodId> {
    // In a real implementation, this would use a UUID generator
    return `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as PeriodId;
  }
}

export interface CreatePeriodCommand {
  readonly periodId?: PeriodId; // Auto-generated if not provided
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly auditContext: AuditContext;
}

export interface CreatePeriodResponse {
  readonly period: Period;
  readonly periodId: PeriodId;
  readonly name: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly status: string;
  readonly durationDays: number;
  readonly isCurrent: boolean;
  readonly createdAt: Date;
}

export interface PeriodValidationResult {
  readonly isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly durationDays: number;
  readonly suggestedName: string;
}

interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly details?: any;
}