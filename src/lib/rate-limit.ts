import {Ratelimit} from '@upstash/ratelimit';
import {kv} from '@vercel/kv';
import {NextRequest} from 'next/server';

/**
 * Enterprise-grade rate limiting using Upstash/Vercel KV
 * Configured for financial application security requirements
 */

// OAuth token endpoint - stricter limits for authentication
export const oauthRateLimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
    analytics: true,
    prefix: 'ratelimit:oauth',
});

// General API endpoints - moderate limits for business operations
export const apiRateLimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
});

// Admin endpoints - very strict limits for sensitive operations
export const adminRateLimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 requests per minute
    analytics: true,
    prefix: 'ratelimit:admin',
});

// Authentication attempts - strict limits to prevent brute force
export const authRateLimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(5, '15 m'), // 5 attempts per 15 minutes
    analytics: true,
    prefix: 'ratelimit:auth',
});

/**
 * Get client identifier for rate limiting
 * Uses multiple fallbacks for reliability
 */
export function getClientIdentifier(request: NextRequest): string {
    // Try to get client credentials from Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Basic ')) {
        try {
            const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
            const [clientId] = credentials.split(':');
            if (clientId && clientId.startsWith('client_')) {
                return `client:${clientId}`;
            }
        } catch {
            // Fall through to other identifiers
        }
    }

    // Try Bearer token for API requests
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (token && token.length >= 64) {
            // Use first 16 chars of token hash for rate limiting
            const crypto = require('crypto');
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            return `token:${tokenHash.substring(0, 16)}`;
        }
    }

    // Fallback to IP address with X-Forwarded-For support
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ip = forwardedFor?.split(',')[0] || realIp || request.ip || 'unknown';

    return `ip:${ip}`;
}

/**
 * Apply rate limiting to a request
 * Returns rate limit result with success/failure and remaining requests
 */
export async function applyRateLimit(
    rateLimit: Ratelimit,
    identifier: string
): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: Date;
}> {
    try {
        const result = await rateLimit.limit(identifier);

        return {
            success: result.success,
            limit: result.limit,
            remaining: result.remaining,
            reset: new Date(result.reset),
        };
    } catch (error) {
        console.error('Rate limit error:', error);
        // Fail open - allow request if rate limiter fails
        return {
            success: true,
            limit: 0,
            remaining: 0,
            reset: new Date(),
        };
    }
}

/**
 * Rate limit specific to OAuth client authentication
 * Uses client ID for precise rate limiting per client
 */
export async function rateLimitOAuthClient(
    clientId: string
): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: Date;
}> {
    return applyRateLimit(authRateLimit, `oauth_client:${clientId}`);
}