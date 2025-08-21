/**
 * Email rate limiting to prevent abuse and API quota exhaustion
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
    blocked: boolean;
}

export interface RateLimitConfig {
    maxEmailsPerHour: number;
    maxEmailsPerDay: number;
    blockDurationMinutes: number;
    enabled: boolean;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    reason?: string;
}

export class EmailRateLimit {
    private static hourlyLimits = new Map<string, RateLimitEntry>();
    private static dailyLimits = new Map<string, RateLimitEntry>();
    private static globalLimits = new Map<string, RateLimitEntry>();

    private static readonly DEFAULT_CONFIG: RateLimitConfig = {
        maxEmailsPerHour: 10,      // Per email address
        maxEmailsPerDay: 50,       // Per email address
        blockDurationMinutes: 15,  // Block duration after limit exceeded
        enabled: true
    };

    /**
     * Check if email sending is allowed for a specific recipient
     */
    static checkEmailLimit(
        email: string,
        config: RateLimitConfig = this.DEFAULT_CONFIG
    ): RateLimitResult {
        if (!config.enabled) {
            return {allowed: true, remaining: Infinity, resetTime: 0};
        }

        const now = Date.now();
        const hourKey = `${email}:hour`;
        const dayKey = `${email}:day`;

        // Check hourly limit
        const hourlyResult = this.checkLimit(
            hourKey,
            config.maxEmailsPerHour,
            60 * 60 * 1000, // 1 hour
            now,
            config.blockDurationMinutes
        );

        if (!hourlyResult.allowed) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: hourlyResult.resetTime,
                reason: `Hourly limit exceeded (${config.maxEmailsPerHour} emails/hour)`
            };
        }

        // Check daily limit
        const dailyResult = this.checkLimit(
            dayKey,
            config.maxEmailsPerDay,
            24 * 60 * 60 * 1000, // 24 hours
            now,
            config.blockDurationMinutes
        );

        if (!dailyResult.allowed) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: dailyResult.resetTime,
                reason: `Daily limit exceeded (${config.maxEmailsPerDay} emails/day)`
            };
        }

        return {
            allowed: true,
            remaining: Math.min(hourlyResult.remaining, dailyResult.remaining),
            resetTime: Math.min(hourlyResult.resetTime, dailyResult.resetTime)
        };
    }

    /**
     * Check global rate limits (for the entire application)
     */
    static checkGlobalLimit(): RateLimitResult {
        const now = Date.now();
        const globalKey = 'global:hour';

        // Global limit: 500 emails per hour for the entire app
        const result = this.checkLimit(
            globalKey,
            500,
            60 * 60 * 1000, // 1 hour
            now,
            30 // 30 minute block
        );

        if (!result.allowed) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: result.resetTime,
                reason: 'Global rate limit exceeded (500 emails/hour)'
            };
        }

        return result;
    }

    /**
     * Record successful email send (increment counters)
     */
    static recordEmailSent(email: string): void {
        const now = Date.now();
        const hourKey = `${email}:hour`;
        const dayKey = `${email}:day`;
        const globalKey = 'global:hour';

        // Increment email-specific counters
        this.incrementCounter(hourKey, 60 * 60 * 1000, now);
        this.incrementCounter(dayKey, 24 * 60 * 60 * 1000, now);

        // Increment global counter
        this.incrementCounter(globalKey, 60 * 60 * 1000, now);
    }

    /**
     * Get current rate limit status for an email (for debugging)
     */
    static getLimitStatus(email: string): {
        hourly: { count: number; remaining: number; resetTime: Date };
        daily: { count: number; remaining: number; resetTime: Date };
    } {
        const now = Date.now();
        const hourKey = `${email}:hour`;
        const dayKey = `${email}:day`;

        const hourlyEntry = this.hourlyLimits.get(hourKey);
        const dailyEntry = this.dailyLimits.get(dayKey);

        return {
            hourly: {
                count: hourlyEntry?.count || 0,
                remaining: this.DEFAULT_CONFIG.maxEmailsPerHour - (hourlyEntry?.count || 0),
                resetTime: new Date(hourlyEntry?.resetTime || now)
            },
            daily: {
                count: dailyEntry?.count || 0,
                remaining: this.DEFAULT_CONFIG.maxEmailsPerDay - (dailyEntry?.count || 0),
                resetTime: new Date(dailyEntry?.resetTime || now)
            }
        };
    }

    /**
     * Clear all rate limits (for testing or admin override)
     */
    static clearLimits(): void {
        this.hourlyLimits.clear();
        this.dailyLimits.clear();
        this.globalLimits.clear();
    }

    /**
     * Configure rate limits
     */
    static configure(config: Partial<RateLimitConfig>): RateLimitConfig {
        return {...this.DEFAULT_CONFIG, ...config};
    }

    /**
     * Check rate limit for a specific key
     */
    private static checkLimit(
        key: string,
        maxCount: number,
        windowMs: number,
        now: number,
        blockDurationMinutes: number
    ): RateLimitResult {
        const limits = this.getLimitMap(key);
        let entry = limits.get(key);

        // Initialize or reset if window expired
        if (!entry || now >= entry.resetTime) {
            entry = {
                count: 0,
                resetTime: now + windowMs,
                blocked: false
            };
            limits.set(key, entry);
        }

        // Check if still blocked from previous violation
        if (entry.blocked) {
            const blockExpiry = entry.resetTime + (blockDurationMinutes * 60 * 1000);
            if (now < blockExpiry) {
                return {
                    allowed: false,
                    remaining: 0,
                    resetTime: blockExpiry
                };
            } else {
                // Unblock and reset
                entry.blocked = false;
                entry.count = 0;
                entry.resetTime = now + windowMs;
            }
        }

        // Check if limit would be exceeded
        if (entry.count >= maxCount) {
            entry.blocked = true;
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.resetTime + (blockDurationMinutes * 60 * 1000)
            };
        }

        return {
            allowed: true,
            remaining: maxCount - entry.count,
            resetTime: entry.resetTime
        };
    }

    /**
     * Increment counter for successful email send
     */
    private static incrementCounter(key: string, windowMs: number, now: number): void {
        const limits = this.getLimitMap(key);
        let entry = limits.get(key);

        if (!entry || now >= entry.resetTime) {
            entry = {
                count: 1,
                resetTime: now + windowMs,
                blocked: false
            };
        } else {
            entry.count++;
        }

        limits.set(key, entry);
    }

    /**
     * Get appropriate limit map based on key type
     */
    private static getLimitMap(key: string): Map<string, RateLimitEntry> {
        if (key.includes(':hour')) {
            return key.startsWith('global') ? this.globalLimits : this.hourlyLimits;
        }
        return this.dailyLimits;
    }
}

/**
 * Middleware for API endpoints to check rate limits
 */
export function checkApiRateLimit(email: string): RateLimitResult {
    // Check global limits first
    const globalLimit = EmailRateLimit.checkGlobalLimit();
    if (!globalLimit.allowed) {
        return globalLimit;
    }

    // Then check email-specific limits
    return EmailRateLimit.checkEmailLimit(email);
}