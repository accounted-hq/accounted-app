/**
 * Email Integration Test Script
 *
 * Tests the Brevo email integration to ensure it's working correctly.
 * Run with: node src/test/email-test.js
 */

const baseUrl = 'http://localhost:8888';

async function testEmailIntegration() {
    console.log('🚀 Starting Email Integration Tests\n');
    console.log('==================================================\n');

    try {
        // Test 1: Check email service status
        console.log('📧 Testing email service status...');
        const statusResponse = await fetch(`${baseUrl}/api/test-email`, {
            method: 'GET',
        });

        const statusData = await statusResponse.json();
        console.log('   Status:', statusResponse.status);
        console.log('   Response:', JSON.stringify(statusData, null, 2));

        if (statusData.configured) {
            console.log('   ✅ Email service is configured and ready\n');
        } else {
            console.log('   ⚠️  Email service not configured (using fallback mode)\n');
            console.log('   💡 To enable email sending:');
            console.log('      1. Get your Brevo API key from https://app.brevo.com/settings/keys/api');
            console.log('      2. Set BREVO_API_KEY in your .env.local file');
            console.log('      3. Restart the development server\n');
            return;
        }

        // Test 2: Configuration test email (only if configured)
        const testEmail = 'test@tmp.acnte.net';

        console.log('📬 Testing configuration email...');
        const configTestResponse = await fetch(`${baseUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                testEmail,
                type: 'config'
            }),
        });

        const configResult = await configTestResponse.json();
        console.log('   Status:', configTestResponse.status);
        console.log('   Response:', JSON.stringify(configResult, null, 2));

        if (configResult.success) {
            console.log('   ✅ Configuration test email sent successfully\n');
        } else {
            console.log('   ❌ Configuration test failed\n');
        }

        // Test 3: Email verification template
        console.log('📨 Testing email verification template...');
        const verificationTestResponse = await fetch(`${baseUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                testEmail,
                type: 'verification'
            }),
        });

        const verificationResult = await verificationTestResponse.json();
        console.log('   Status:', verificationTestResponse.status);
        console.log('   Response:', JSON.stringify(verificationResult, null, 2));

        if (verificationResult.success) {
            console.log('   ✅ Email verification template sent successfully\n');
        } else {
            console.log('   ❌ Email verification test failed\n');
        }

        // Test 4: Password reset template
        console.log('🔐 Testing password reset template...');
        const passwordResetResponse = await fetch(`${baseUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                testEmail,
                type: 'password-reset'
            }),
        });

        const passwordResetResult = await passwordResetResponse.json();
        console.log('   Status:', passwordResetResponse.status);
        console.log('   Response:', JSON.stringify(passwordResetResult, null, 2));

        if (passwordResetResult.success) {
            console.log('   ✅ Password reset template sent successfully\n');
        } else {
            console.log('   ❌ Password reset test failed\n');
        }

        // Test 5: Welcome email template
        console.log('🎉 Testing welcome email template...');
        const welcomeResponse = await fetch(`${baseUrl}/api/test-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                testEmail,
                type: 'welcome'
            }),
        });

        const welcomeResult = await welcomeResponse.json();
        console.log('   Status:', welcomeResponse.status);
        console.log('   Response:', JSON.stringify(welcomeResult, null, 2));

        if (welcomeResult.success) {
            console.log('   ✅ Welcome email template sent successfully\n');
        } else {
            console.log('   ❌ Welcome email test failed\n');
        }

    } catch (error) {
        console.error('❌ Email integration test failed:', error.message);
    }

    console.log('==================================================');
    console.log('🏁 Email integration tests completed!\n');

    console.log('📋 Next steps:');
    console.log('   1. Configure your Brevo API key in .env.local');
    console.log('   2. Test user registration to verify email verification flow');
    console.log('   3. Test password reset flow in the application');
    console.log('   4. Check test@tmp.acnte.net for received emails');
}

// Run the test
testEmailIntegration().catch(console.error);