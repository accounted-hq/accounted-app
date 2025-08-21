import {NextRequest, NextResponse} from 'next/server';
import {
    apiRateLimit,
    oauthRateLimit,
    adminRateLimit,
    getClientIdentifier,
    applyRateLimit
} from './lib/rate-limit';

/**
 * Next.js middleware for enterprise-grade API rate limiting
 * Protects all API endpoints with configurable limits
 */
export async function middleware(request: NextRequest) {
    const {pathname} = request.nextUrl;

    // Only apply rate limiting to API routes
    if (!pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Determine appropriate rate limiter based on endpoint
    let rateLimit;
    let rateLimitType: string;

    if (pathname.startsWith('/api/oauth/')) {
        rateLimit = oauthRateLimit;
        rateLimitType = 'oauth';
    } else if (pathname.startsWith('/api/admin/')) {
        rateLimit = adminRateLimit;
        rateLimitType = 'admin';
    } else {
        rateLimit = apiRateLimit;
        rateLimitType = 'api';
    }

    // Get client identifier for rate limiting
    const identifier = getClientIdentifier(request);

    // Apply rate limiting
    const result = await applyRateLimit(rateLimit, identifier);

    // Create response with rate limit headers
    const response = result.success
        ? NextResponse.next()
        : new NextResponse(
            JSON.stringify({
                error: 'rate_limit_exceeded',
                message: 'Too many requests. Please try again later.',
                retry_after: Math.ceil((result.reset.getTime() - Date.now()) / 1000),
            }),
            {
                status: 429,
                headers: {'Content-Type': 'application/json'}
            }
        );

    // Add standard rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.getTime().toString());
    response.headers.set('X-RateLimit-Type', rateLimitType);

    // Log rate limit violations for security monitoring
    if (!result.success) {
        console.warn('Rate limit exceeded', {
            type: rateLimitType,
            identifier: identifier.substring(0, 20) + '...', // Truncate for privacy
            endpoint: pathname,
            timestamp: new Date().toISOString(),
            remaining: result.remaining,
            reset: result.reset.toISOString(),
        });
    }

    return response;
}

/**
 * Configure which routes the middleware runs on
 * Only API routes for optimal performance
 */
export const config = {
    matcher: [
        '/api/(.*)',
    ],
};