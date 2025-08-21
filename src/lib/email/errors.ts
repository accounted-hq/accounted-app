/**
 * Email service error handling and classification
 */

export enum EmailErrorType {
    VALIDATION = 'validation',
    AUTHENTICATION = 'authentication',
    QUOTA_EXCEEDED = 'quota_exceeded',
    RATE_LIMITED = 'rate_limited',
    NETWORK = 'network',
    TEMPLATE = 'template',
    RECIPIENT = 'recipient',
    UNKNOWN = 'unknown'
}

export interface EmailError {
    type: EmailErrorType;
    code?: string;
    message: string;
    retryable: boolean;
    retryAfter?: number; // seconds to wait before retry
    originalError?: any;
    timestamp: Date;
}

export class EmailServiceError extends Error {
    public readonly emailError: EmailError;

    constructor(emailError: EmailError) {
        super(emailError.message);
        this.name = 'EmailServiceError';
        this.emailError = emailError;
    }
}

/**
 * Classify Brevo API errors into actionable categories
 */
export function classifyBrevoError(error: any): EmailError {
    const timestamp = new Date();

    // Handle network/connection errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        return {
            type: EmailErrorType.NETWORK,
            code: error.code,
            message: 'Network connection error',
            retryable: true,
            retryAfter: 30,
            originalError: error,
            timestamp
        };
    }

    // Handle HTTP status code errors
    if (error.response?.status) {
        const status = error.response.status;
        const responseData = error.response.data;

        switch (status) {
            case 400:
                return {
                    type: EmailErrorType.VALIDATION,
                    code: responseData?.code || 'BAD_REQUEST',
                    message: responseData?.message || 'Invalid request parameters',
                    retryable: false,
                    originalError: error,
                    timestamp
                };

            case 401:
                return {
                    type: EmailErrorType.AUTHENTICATION,
                    code: 'UNAUTHORIZED',
                    message: 'Invalid API key or authentication failed',
                    retryable: false,
                    originalError: error,
                    timestamp
                };

            case 402:
                return {
                    type: EmailErrorType.QUOTA_EXCEEDED,
                    code: 'QUOTA_EXCEEDED',
                    message: 'Account quota exceeded or payment required',
                    retryable: false,
                    originalError: error,
                    timestamp
                };

            case 429:
                const retryAfter = parseInt(error.response.headers['retry-after'] || '60');
                return {
                    type: EmailErrorType.RATE_LIMITED,
                    code: 'RATE_LIMITED',
                    message: 'Rate limit exceeded',
                    retryable: true,
                    retryAfter,
                    originalError: error,
                    timestamp
                };

            case 500:
            case 502:
            case 503:
            case 504:
                return {
                    type: EmailErrorType.NETWORK,
                    code: `HTTP_${status}`,
                    message: 'Server error, retry may succeed',
                    retryable: true,
                    retryAfter: 60,
                    originalError: error,
                    timestamp
                };

            default:
                return {
                    type: EmailErrorType.UNKNOWN,
                    code: `HTTP_${status}`,
                    message: responseData?.message || `HTTP ${status} error`,
                    retryable: status >= 500,
                    originalError: error,
                    timestamp
                };
        }
    }

    // Handle validation errors
    if (error.message?.includes('Invalid email') || error.message?.includes('validation')) {
        return {
            type: EmailErrorType.VALIDATION,
            message: error.message,
            retryable: false,
            originalError: error,
            timestamp
        };
    }

    // Generic error
    return {
        type: EmailErrorType.UNKNOWN,
        message: error.message || 'Unknown email service error',
        retryable: false,
        originalError: error,
        timestamp
    };
}

/**
 * Retry logic with exponential backoff
 */
export class EmailRetryHandler {
    private static readonly MAX_RETRIES = 3;
    private static readonly BASE_DELAY = 1000; // 1 second

    static async executeWithRetry<T>(
        operation: () => Promise<T>,
        maxRetries: number = this.MAX_RETRIES
    ): Promise<T> {
        let lastError: EmailError | null = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                const emailError = error instanceof EmailServiceError
                    ? error.emailError
                    : classifyBrevoError(error);

                lastError = emailError;

                // Don't retry non-retryable errors
                if (!emailError.retryable) {
                    throw new EmailServiceError(emailError);
                }

                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Calculate delay with exponential backoff
                const baseDelay = emailError.retryAfter
                    ? emailError.retryAfter * 1000
                    : this.BASE_DELAY;
                const delay = baseDelay * Math.pow(2, attempt);

                console.warn(`🔄 Email operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, {
                    type: emailError.type,
                    message: emailError.message,
                    retryAfter: delay
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // All retries exhausted
        if (lastError) {
            throw new EmailServiceError(lastError);
        }

        throw new Error('Unexpected error in retry handler');
    }
}

/**
 * Email operation result with detailed success/failure information
 */
export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: EmailError;
    attempts?: number;
    duration?: number;
}

/**
 * Create standardized email result
 */
export function createEmailResult(
    success: boolean,
    options: {
        messageId?: string;
        error?: EmailError;
        attempts?: number;
        startTime?: number;
    } = {}
): EmailResult {
    const result: EmailResult = {
        success,
        messageId: options.messageId,
        error: options.error,
        attempts: options.attempts || 1
    };

    if (options.startTime) {
        result.duration = Date.now() - options.startTime;
    }

    return result;
}