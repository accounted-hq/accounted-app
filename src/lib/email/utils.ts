import validator from 'validator';

/**
 * Email utility functions for security and validation
 */

/**
 * Mask email address for logging purposes (GDPR compliance)
 */
export function maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
        return '***';
    }

    const [local, domain] = email.split('@');

    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }

    return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Mask multiple email addresses
 */
export function maskEmails(emails: string[]): string[] {
    return emails.map(maskEmail);
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
        return false;
    }

    return validator.isEmail(email, {
        allow_utf8_local_part: false,
        require_tld: true,
        allow_ip_domain: false
    });
}

/**
 * Check if email domain is from a disposable email service
 */
export function isDisposableEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();

    // Common disposable email domains
    const disposableDomains = [
        '10minutemail.com',
        'guerrillamail.com',
        'mailinator.com',
        'temp-mail.org',
        'throwaway.email',
        'tempmail.net',
        'getnada.com',
        'yopmail.com'
    ];

    return disposableDomains.includes(domain);
}

/**
 * Validate email for business use (no disposable emails)
 */
export function isValidBusinessEmail(email: string): { valid: boolean; reason?: string } {
    if (!isValidEmail(email)) {
        return {valid: false, reason: 'Invalid email format'};
    }

    if (isDisposableEmail(email)) {
        return {valid: false, reason: 'Disposable email addresses not allowed'};
    }

    return {valid: true};
}

/**
 * Sanitize template data to prevent injection attacks
 */
export function sanitizeTemplateData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            // Basic HTML escaping
            sanitized[key] = value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;');
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

/**
 * Validate required template fields
 */
export function validateTemplateData(data: any, requiredFields: string[]): void {
    const missing = requiredFields.filter(field => {
        const value = data[field];
        return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
        throw new Error(`Missing required template fields: ${missing.join(', ')}`);
    }
}

/**
 * Create secure logging object with masked sensitive data
 */
export function createSecureLogData(data: {
    recipients?: string[];
    subject?: string;
    type?: string;
    messageId?: string;
    error?: string;
}): Record<string, any> {
    return {
        recipients: data.recipients ? maskEmails(data.recipients) : undefined,
        subject: data.subject,
        type: data.type,
        messageId: data.messageId,
        error: data.error,
        timestamp: new Date().toISOString()
    };
}