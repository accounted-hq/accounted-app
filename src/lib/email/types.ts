// Email service types for Brevo integration

export interface EmailTemplate {
    subject: string;
    htmlContent: string;
    textContent?: string;
}

export interface EmailRecipient {
    email: string;
    name?: string;
}

export interface EmailSendOptions {
    to: EmailRecipient[];
    cc?: EmailRecipient[];
    bcc?: EmailRecipient[];
    replyTo?: EmailRecipient;
    headers?: Record<string, string>;
    tags?: string[];
}

export interface EmailVerificationData {
    user: {
        email: string;
        name?: string;
    };
    url: string;
    token: string;
}

export interface PasswordResetData {
    user: {
        email: string;
        name?: string;
    };
    url: string;
    token: string;
}

export interface EmailServiceConfig {
    apiKey: string;
    defaultFrom: {
        email: string;
        name: string;
    };
    templates?: {
        emailVerification?: number; // Brevo template ID
        passwordReset?: number;     // Brevo template ID
        welcome?: number;           // Brevo template ID
    };
}