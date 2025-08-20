/**
 * Simple test script to verify BetterAuth authentication flow
 * Run with: node src/test/auth-test.js
 */

const baseUrl = 'http://localhost:8888';

async function testAuthEndpoint() {
    try {
        console.log('🔧 Testing BetterAuth API endpoints...\n');

        // Test 1: Check if auth API is accessible
        console.log('1. Testing auth API availability...');
        const healthResponse = await fetch(`${baseUrl}/api/auth/get-session`, {
            method: 'GET',
        });

        console.log(`   Status: ${healthResponse.status}`);
        if (healthResponse.status === 401 || healthResponse.status === 200) {
            console.log('   ✅ Auth API is accessible\n');
        } else {
            console.log('   ❌ Auth API may have issues\n');
            return;
        }

        // Test 2: Try to create a test user (registration)
        console.log('2. Testing user registration...');
        const testUser = {
            email: `test-${Date.now()}@example.com`,
            password: 'TestPassword123!',
            name: 'Test User',
        };

        const registerResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password,
                name: testUser.name,
            }),
        });

        const registerResult = await registerResponse.json();
        console.log(`   Status: ${registerResponse.status}`);
        console.log(`   Response:`, registerResult);

        if (registerResponse.ok) {
            console.log('   ✅ User registration works\n');
        } else {
            console.log('   ⚠️  Registration failed - this might be expected for validation reasons\n');
        }

        // Test 3: Try to sign in
        console.log('3. Testing user sign-in...');
        const signInResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testUser.email,
                password: testUser.password,
            }),
        });

        const signInResult = await signInResponse.json();
        console.log(`   Status: ${signInResponse.status}`);
        console.log(`   Response:`, signInResult);

        if (signInResponse.ok) {
            console.log('   ✅ User sign-in works');

            // Extract session info if available
            const cookies = signInResponse.headers.get('set-cookie');
            if (cookies) {
                console.log('   ✅ Session cookies set');
            }
        } else {
            console.log('   ❌ Sign-in failed');
        }

        console.log('\n🎉 Auth flow test completed!');

    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
    }
}

// Test database connection
async function testDatabaseConnection() {
    console.log('\n🗄️  Testing database connection...');

    try {
        // Import our database connection
        const {db} = require('../db/connection.js');
        const {user} = require('../db/schema.js');

        // Try a simple query
        const userCount = await db.select().from(user).limit(1);
        console.log('   ✅ Database connection works');
        console.log(`   Users in database: ${userCount.length > 0 ? 'Some exist' : 'None yet'}`);

    } catch (error) {
        console.error('   ❌ Database connection failed:', error.message);
    }
}

// Test organization creation
async function testOrganizationFlow() {
    console.log('\n🏢 Testing organization management...');

    try {
        // Test organization creation endpoint
        const orgData = {
            name: `Test Organization ${Date.now()}`,
            slug: `test-org-${Date.now()}`,
        };

        const createOrgResponse = await fetch(`${baseUrl}/api/auth/organization/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orgData),
        });

        console.log(`   Create org status: ${createOrgResponse.status}`);

        if (createOrgResponse.status === 401) {
            console.log('   ⚠️  Organization creation requires authentication (expected)');
        } else {
            const result = await createOrgResponse.json();
            console.log('   Response:', result);
        }

    } catch (error) {
        console.error('   ❌ Organization test failed:', error.message);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Starting BetterAuth Integration Tests\n');
    console.log('='.repeat(50));

    await testDatabaseConnection();
    await testAuthEndpoint();
    await testOrganizationFlow();

    console.log('\n' + '='.repeat(50));
    console.log('🏁 All tests completed!');
}

// Run the tests
runAllTests().catch(console.error);