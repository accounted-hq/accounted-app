// Email service exports

export {BrevoEmailService, createEmailService, emailService} from './brevo-service';
export {emailTemplates} from './templates';
export {
    maskEmail,
    maskEmails,
    isValidEmail,
    isValidBusinessEmail,
    sanitizeTemplateData,
    validateTemplateData
} from './utils';
export {
    EmailRetryHandler,
    EmailServiceError,
    classifyBrevoError,
    createEmailResult
} from './errors';
export {
    EmailRateLimit,
    checkApiRateLimit
} from './rate-limit';
export type {
    EmailTemplate,
    EmailRecipient,
    EmailSendOptions,
    EmailVerificationData,
    PasswordResetData,
    EmailServiceConfig
} from './types';
export type {
    EmailError,
    EmailResult
} from './errors';
export type {
    RateLimitConfig,
    RateLimitResult
} from './rate-limit';