import {NextRequest, NextResponse} from 'next/server';
import {emailService} from '@/lib/email';

/**
 * Test endpoint for Brevo email integration
 * POST /api/test-email
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {testEmail, type = 'config'} = body;

        if (!testEmail || typeof testEmail !== 'string') {
            return NextResponse.json(
                {error: 'testEmail is required and must be a string'},
                {status: 400}
            );
        }

        // Check if email service is available
        if (!emailService) {
            return NextResponse.json(
                {
                    error: 'Email service not configured. Please set BREVO_API_KEY environment variable.',
                    configured: false
                },
                {status: 503}
            );
        }

        let result;

        switch (type) {
            case 'config':
                // Test basic configuration
                result = await emailService.testConfiguration(testEmail);
                break;

            case 'verification':
                // Test email verification template
                result = await emailService.sendEmailVerification({
                    user: {email: testEmail, name: 'Test User'},
                    url: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/auth/verify-email?token=test-token`,
                    token: 'test-token'
                });
                break;

            case 'password-reset':
                // Test password reset template
                result = await emailService.sendPasswordReset({
                    user: {email: testEmail, name: 'Test User'},
                    url: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/auth/reset-password?token=test-token`,
                    token: 'test-token'
                });
                break;

            case 'welcome':
                // Test welcome template
                result = await emailService.sendWelcomeEmail(
                    {email: testEmail, name: 'Test User'},
                    'Test Organization'
                );
                break;

            default:
                return NextResponse.json(
                    {error: 'Invalid test type. Use: config, verification, password-reset, or welcome'},
                    {status: 400}
                );
        }

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Test email sent successfully to ${testEmail}`,
                messageId: result.messageId,
                attempts: result.attempts,
                duration: result.duration,
                type,
                configured: true
            });
        } else {
            return NextResponse.json({
                success: false,
                error: result.error?.message || 'Unknown error',
                errorType: result.error?.type,
                retryable: result.error?.retryable,
                type,
                configured: true
            }, {status: 500});
        }

    } catch (error) {
        console.error('❌ Test email endpoint error:', error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                success: false
            },
            {status: 500}
        );
    }
}

/**
 * GET endpoint to check email service status
 */
export async function GET() {
    const configured = !!emailService;
    const hasApiKey = !!process.env.BREVO_API_KEY;

    return NextResponse.json({
        configured,
        hasApiKey,
        service: 'Brevo',
        fromEmail: process.env.EMAIL_FROM,
        fromName: process.env.EMAIL_FROM_NAME,
        status: configured ? 'ready' : 'not configured'
    });
}