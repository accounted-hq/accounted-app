import {
    TransactionalEmailsApi,
    TransactionalEmailsApiApiKeys,
    SendSmtpEmail,
    SendSmtpEmailSender,
    SendSmtpEmailTo
} from '@getbrevo/brevo';
import {
    EmailServiceConfig,
    EmailSendOptions,
    EmailRecipient,
    EmailVerificationData,
    PasswordResetData,
    EmailTemplate
} from './types';
import {emailTemplates} from './templates';
import {
    maskEmail,
    maskEmails,
    isValidBusinessEmail,
    sanitizeTemplateData,
    validateTemplateData,
    createSecureLogData
} from './utils';
import {
    EmailRetryHandler,
    EmailServiceError,
    createEmailResult,
    EmailResult
} from './errors';
import {
    EmailRateLimit,
    checkApiRateLimit,
    RateLimitConfig
} from './rate-limit';

/**
 * Brevo Email Service
 *
 * Handles all email operations using Brevo (formerly Sendinblue) API.
 * Provides methods for sending transactional emails including:
 * - Email verification
 * - Password reset
 * - Welcome emails
 * - Custom templates
 */
export class BrevoEmailService {
    private apiInstance: TransactionalEmailsApi;
    private config: EmailServiceConfig;
    private rateLimitConfig: RateLimitConfig;

    constructor(config: EmailServiceConfig, rateLimitConfig?: Partial<RateLimitConfig>) {
        this.config = config;
        this.rateLimitConfig = EmailRateLimit.configure(rateLimitConfig || {});

        // Validate API key format (basic check)
        if (!config.apiKey.startsWith('xkeysib-')) {
            throw new Error('Invalid Brevo API key format');
        }

        // Initialize Brevo API client
        this.apiInstance = new TransactionalEmailsApi();
        this.apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, config.apiKey);

        console.log('🔧 Brevo email service initialized', {
            fromEmail: maskEmail(config.defaultFrom.email),
            fromName: config.defaultFrom.name,
            rateLimiting: this.rateLimitConfig.enabled
        });
    }

    /**
     * Send a generic email using Brevo with security enhancements
     */
    async sendEmail(
        template: EmailTemplate,
        options: EmailSendOptions
    ): Promise<EmailResult> {
        const startTime = Date.now();

        try {
            // Input validation
            if (!options.to || options.to.length === 0) {
                throw new EmailServiceError({
                    type: 'validation' as any,
                    message: 'At least one recipient is required',
                    retryable: false,
                    timestamp: new Date()
                });
            }

            // Validate all email addresses
            const allEmails = [
                ...options.to.map(r => r.email),
                ...(options.cc || []).map(r => r.email),
                ...(options.bcc || []).map(r => r.email)
            ];

            for (const email of allEmails) {
                const validation = isValidBusinessEmail(email);
                if (!validation.valid) {
                    throw new EmailServiceError({
                        type: 'validation' as any,
                        message: `Invalid email ${maskEmail(email)}: ${validation.reason}`,
                        retryable: false,
                        timestamp: new Date()
                    });
                }
            }

            // Check rate limits for primary recipient
            const primaryEmail = options.to[0].email;
            const rateLimitResult = checkApiRateLimit(primaryEmail);

            if (!rateLimitResult.allowed) {
                throw new EmailServiceError({
                    type: 'rate_limited' as any,
                    message: rateLimitResult.reason || 'Rate limit exceeded',
                    retryable: true,
                    retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
                    timestamp: new Date()
                });
            }

            // Sanitize template to prevent injection
            const sanitizedTemplate = {
                subject: template.subject,
                htmlContent: template.htmlContent, // Templates are pre-built, so no user input
                textContent: template.textContent
            };

            // Execute with retry logic
            const result = await EmailRetryHandler.executeWithRetry(async () => {
                return await this.performEmailSend(sanitizedTemplate, options);
            });

            // Record successful send for rate limiting
            EmailRateLimit.recordEmailSent(primaryEmail);

            // Secure logging
            const logData = createSecureLogData({
                recipients: allEmails,
                subject: template.subject,
                messageId: result.messageId,
                type: options.tags?.[0]
            });

            console.log('✅ Email sent successfully via Brevo:', logData);

            return createEmailResult(true, {
                messageId: result.messageId,
                startTime
            });

        } catch (error) {
            const emailError = error instanceof EmailServiceError
                ? error.emailError
                : {
                    type: 'unknown' as any,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                    timestamp: new Date()
                };

            // Secure error logging
            const logData = createSecureLogData({
                recipients: options.to?.map(r => r.email),
                subject: template.subject,
                error: emailError.message,
                type: options.tags?.[0]
            });

            console.error('❌ Failed to send email via Brevo:', logData);

            return createEmailResult(false, {
                error: emailError,
                startTime
            });
        }
    }

    /**
     * Internal method to perform the actual email send
     */
    private async performEmailSend(
        template: EmailTemplate,
        options: EmailSendOptions
    ): Promise<{ messageId: string }> {
        // Prepare sender
        const sender: SendSmtpEmailSender = {
            email: this.config.defaultFrom.email,
            name: this.config.defaultFrom.name
        };

        // Prepare recipients
        const to: SendSmtpEmailTo[] = options.to.map(recipient => ({
            email: recipient.email,
            name: recipient.name || recipient.email
        }));

        // Prepare email object
        const sendSmtpEmail: SendSmtpEmail = {
            sender,
            to,
            subject: template.subject,
            htmlContent: template.htmlContent,
            textContent: template.textContent
        };

        // Add optional fields with validation
        if (options.cc && options.cc.length > 0) {
            sendSmtpEmail.cc = options.cc.map(recipient => ({
                email: recipient.email,
                name: recipient.name || recipient.email
            }));
        }

        if (options.bcc && options.bcc.length > 0) {
            sendSmtpEmail.bcc = options.bcc.map(recipient => ({
                email: recipient.email,
                name: recipient.name || recipient.email
            }));
        }

        if (options.replyTo) {
            sendSmtpEmail.replyTo = {
                email: options.replyTo.email,
                name: options.replyTo.name || options.replyTo.email
            };
        }

        // Add security headers
        const securityHeaders = {
            'X-Mailer': 'Accounted-App-v1.0',
            'X-Priority': '3', // Normal priority
            'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
            ...options.headers
        };

        sendSmtpEmail.headers = securityHeaders;

        if (options.tags) {
            sendSmtpEmail.tags = options.tags;
        }

        // Send email via Brevo
        const response = await this.apiInstance.sendTransacEmail(sendSmtpEmail);

        return {
            messageId: response.body.messageId || 'unknown'
        };
    }

    /**
     * Send email verification email
     */
    async sendEmailVerification(data: EmailVerificationData): Promise<EmailResult> {
        try {
            // Validate input data
            validateTemplateData(data, ['user', 'url', 'token']);
            validateTemplateData(data.user, ['email']);

            const template = emailTemplates.emailVerification({
                userName: data.user.name,
                verificationUrl: data.url
            });

            return await this.sendEmail(template, {
                to: [{email: data.user.email, name: data.user.name}],
                tags: ['email-verification', 'authentication'],
                headers: {
                    'X-Priority': '1', // High priority
                    'X-Email-Type': 'verification'
                }
            });

        } catch (error) {
            console.error('❌ Email verification error:', {
                email: data.user?.email ? maskEmail(data.user.email) : 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return createEmailResult(false, {
                error: {
                    type: 'validation' as any,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                    timestamp: new Date()
                }
            });
        }
    }

    /**
     * Send password reset email
     */
    async sendPasswordReset(data: PasswordResetData): Promise<EmailResult> {
        try {
            // Validate input data
            validateTemplateData(data, ['user', 'url', 'token']);
            validateTemplateData(data.user, ['email']);

            const template = emailTemplates.passwordReset({
                userName: data.user.name,
                resetUrl: data.url
            });

            return await this.sendEmail(template, {
                to: [{email: data.user.email, name: data.user.name}],
                tags: ['password-reset', 'authentication'],
                headers: {
                    'X-Priority': '1', // High priority
                    'X-Email-Type': 'password-reset'
                }
            });

        } catch (error) {
            console.error('❌ Password reset email error:', {
                email: data.user?.email ? maskEmail(data.user.email) : 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return createEmailResult(false, {
                error: {
                    type: 'validation' as any,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                    timestamp: new Date()
                }
            });
        }
    }

    /**
     * Send welcome email (optional - can be triggered after email verification)
     */
    async sendWelcomeEmail(
        recipient: EmailRecipient,
        organizationName?: string
    ): Promise<EmailResult> {
        try {
            // Validate input data
            validateTemplateData(recipient, ['email']);

            const template = emailTemplates.welcome({
                userName: recipient.name,
                organizationName
            });

            return await this.sendEmail(template, {
                to: [recipient],
                tags: ['welcome', 'onboarding'],
                headers: {
                    'X-Email-Type': 'welcome'
                }
            });

        } catch (error) {
            console.error('❌ Welcome email error:', {
                email: recipient?.email ? maskEmail(recipient.email) : 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return createEmailResult(false, {
                error: {
                    type: 'validation' as any,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                    timestamp: new Date()
                }
            });
        }
    }

    /**
     * Test email configuration by sending a test email
     */
    async testConfiguration(testEmail: string): Promise<EmailResult> {
        try {
            // Validate test email
            const validation = isValidBusinessEmail(testEmail);
            if (!validation.valid) {
                throw new Error(`Invalid test email: ${validation.reason}`);
            }

            const template: EmailTemplate = {
                subject: 'Brevo Configuration Test - Accounted App',
                htmlContent: `
          <h2>Email Configuration Test</h2>
          <p>This is a test email to verify that your Brevo email integration is working correctly.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>Service: Brevo (Sendinblue)</li>
            <li>From: ${this.config.defaultFrom.name} &lt;${maskEmail(this.config.defaultFrom.email)}&gt;</li>
            <li>Timestamp: ${new Date().toISOString()}</li>
            <li>Rate Limiting: ${this.rateLimitConfig.enabled ? 'Enabled' : 'Disabled'}</li>
          </ul>
          <p>If you received this email, your integration is working properly!</p>
        `,
                textContent: `
          Email Configuration Test - Accounted App
          
          This is a test email to verify that your Brevo email integration is working correctly.
          
          Configuration Details:
          - Service: Brevo (Sendinblue)
          - From: ${this.config.defaultFrom.name} <${maskEmail(this.config.defaultFrom.email)}>
          - Timestamp: ${new Date().toISOString()}
          - Rate Limiting: ${this.rateLimitConfig.enabled ? 'Enabled' : 'Disabled'}
          
          If you received this email, your integration is working properly!
        `
            };

            return await this.sendEmail(template, {
                to: [{email: testEmail}],
                tags: ['test', 'configuration'],
                headers: {
                    'X-Email-Type': 'test'
                }
            });

        } catch (error) {
            console.error('❌ Email configuration test failed:', {
                testEmail: maskEmail(testEmail),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return createEmailResult(false, {
                error: {
                    type: 'validation' as any,
                    message: error instanceof Error ? error.message : 'Unknown error',
                    retryable: false,
                    timestamp: new Date()
                }
            });
        }
    }
}

/**
 * Create and configure the email service instance
 */
export function createEmailService(): BrevoEmailService | null {
    try {
        const apiKey = process.env.BREVO_API_KEY;

        if (!apiKey) {
            console.warn('⚠️ BREVO_API_KEY not found in environment variables. Email functionality will be disabled.');
            return null;
        }

        const config: EmailServiceConfig = {
            apiKey,
            defaultFrom: {
                email: process.env.EMAIL_FROM || 'noreply@accounted-app.local',
                name: process.env.EMAIL_FROM_NAME || 'Accounted App'
            }
        };

        return new BrevoEmailService(config);

    } catch (error) {
        console.error('❌ Failed to create email service:', error);
        return null;
    }
}

// Export a singleton instance
export const emailService = createEmailService();