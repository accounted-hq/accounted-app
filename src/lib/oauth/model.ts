import {eq, and, lt} from 'drizzle-orm';
import bcrypt from 'bcrypt';
import {db} from '@/db/connection';
import {oauthClients, oauthTokens, organization} from '@/db/schema';
import crypto from 'crypto';

export interface OAuthClient {
    id: string;
    organizationId: string;
    grants: string[];
    scopes?: string[];
    clientSecret?: string;
}

export interface OAuthToken {
    accessToken: string;
    accessTokenExpiresAt: Date;
    refreshToken?: string;
    refreshTokenExpiresAt?: Date;
    scope?: string[];
    client: OAuthClient;
    user?: any; // Not used in client_credentials flow
}

/**
 * OAuth2 Model for @node-oauth/oauth2-server
 * Implements required methods for Client Credentials Flow
 */
export class OAuthModel {
    private readonly SALT_ROUNDS = 12;
    private readonly TOKEN_PATTERN = /^[a-f0-9]{128}$/; // 512 bits = 128 hex chars
    private readonly CLIENT_ID_PATTERN = /^client_[a-f0-9]{32}$/;
    private readonly MIN_SECRET_ENTROPY = 4.5; // bits per character
    // Pre-computed valid bcrypt hash for timing attack prevention
    private readonly DUMMY_HASH = '$2b$12$jHtPjV2nfLAOdh7WhQK04.PWtAQUeCIp7EYsL9TBU4Dbld2SRPQE6';

    // Rate limiting for authentication attempts
    private readonly authAttempts = new Map<string, { count: number; resetTime: number }>();
    private readonly MAX_AUTH_ATTEMPTS = 5;
    private readonly AUTH_LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

    /**
     * Calculate Shannon entropy of a string
     */
    private calculateEntropy(str: string): number {
        const freq = new Map<string, number>();
        for (const char of str) {
            freq.set(char, (freq.get(char) || 0) + 1);
        }

        let entropy = 0;
        const length = str.length;
        for (const count of freq.values()) {
            const p = count / length;
            entropy -= p * Math.log2(p);
        }

        return entropy;
    }

    /**
     * Check rate limiting for authentication attempts
     */
    private isRateLimited(clientId: string): boolean {
        const attempt = this.authAttempts.get(clientId);
        const now = Date.now();

        if (!attempt) return false;

        // Reset if lockout time expired
        if (now > attempt.resetTime) {
            this.authAttempts.delete(clientId);
            return false;
        }

        return attempt.count >= this.MAX_AUTH_ATTEMPTS;
    }

    /**
     * Record failed authentication attempt
     */
    private recordFailedAttempt(clientId: string): void {
        const attempt = this.authAttempts.get(clientId);
        const now = Date.now();

        if (!attempt || now > attempt.resetTime) {
            this.authAttempts.set(clientId, {
                count: 1,
                resetTime: now + this.AUTH_LOCKOUT_TIME
            });
        } else {
            attempt.count++;
        }
    }

    /**
     * Validate input parameters with enterprise-grade security
     */
    private validateInput(type: string, value: string): boolean {
        if (!value || typeof value !== 'string') return false;

        switch (type) {
            case 'token':
                return this.TOKEN_PATTERN.test(value) && value.length === 128; // 512 bits
            case 'clientId':
                return this.CLIENT_ID_PATTERN.test(value) && value.length >= 10 && value.length <= 255;
            case 'clientSecret':
                if (value.length < 32 || value.length > 255) return false;
                // Validate entropy to prevent weak secrets
                return this.calculateEntropy(value) >= this.MIN_SECRET_ENTROPY;
            default:
                return false;
        }
    }

    /**
     * Safely parse JSON with error handling
     */
    private safeJsonParse(jsonString: any, fallback: any = []): any {
        if (Array.isArray(jsonString)) return jsonString;
        if (typeof jsonString !== 'string') return fallback;

        try {
            const parsed = JSON.parse(jsonString);
            return Array.isArray(parsed) ? parsed : fallback;
        } catch {
            return fallback;
        }
    }

    /**
     * Retrieve a client by client_id and optionally validate client_secret
     * Required for client_credentials grant
     */
    async getClient(clientId: string, clientSecret?: string): Promise<OAuthClient | null> {
        try {
            // Validate inputs
            if (!this.validateInput('clientId', clientId)) {
                return null;
            }
            if (clientSecret && !this.validateInput('clientSecret', clientSecret)) {
                return null;
            }

            const result = await db
                .select({
                    id: oauthClients.id,
                    clientId: oauthClients.clientId,
                    clientSecret: oauthClients.clientSecret,
                    organizationId: oauthClients.organizationId,
                    grants: oauthClients.grants,
                    scopes: oauthClients.scopes,
                    isActive: oauthClients.isActive,
                })
                .from(oauthClients)
                .where(
                    and(
                        eq(oauthClients.clientId, clientId),
                        eq(oauthClients.isActive, true)
                    )
                )
                .limit(1);

            if (!result.length) {
                // Record failed attempt and check rate limiting
                this.recordFailedAttempt(clientId);

                // Constant-time delay using valid pre-computed hash
                if (clientSecret) {
                    await bcrypt.compare(clientSecret, this.DUMMY_HASH);
                }
                return null;
            }

            const client = result[0];

            // Check rate limiting before authentication
            if (this.isRateLimited(clientId)) {
                // Still perform bcrypt to maintain constant time
                if (clientSecret) {
                    await bcrypt.compare(clientSecret, this.DUMMY_HASH);
                }
                return null;
            }

            // Validate client secret if provided
            if (clientSecret) {
                const isValidSecret = await bcrypt.compare(clientSecret, client.clientSecret);
                if (!isValidSecret) {
                    this.recordFailedAttempt(clientId);
                    return null;
                }
                // Clear failed attempts on successful auth
                this.authAttempts.delete(clientId);
            }

            return {
                id: client.clientId,
                organizationId: client.organizationId,
                grants: this.safeJsonParse(client.grants, ['client_credentials']),
                scopes: this.safeJsonParse(client.scopes, ['read', 'write']),
            };
        } catch (error) {
            // Log security event for audit trail
            console.error('OAuth getClient security event', {
                clientId: clientId?.substring(0, 8) + '...', // Partial ID for audit
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.name : 'Unknown error'
            });
            return null;
        }
    }

    /**
     * Save an access token
     * Required for all grant types
     */
    async saveToken(token: any, client: OAuthClient, user?: any): Promise<OAuthToken> {
        try {
            // Validate token format
            if (!this.validateInput('token', token.accessToken)) {
                throw new Error('Invalid token format');
            }

            // Get the client's database ID for foreign key
            const clientRecord = await db
                .select({id: oauthClients.id})
                .from(oauthClients)
                .where(eq(oauthClients.clientId, client.id))
                .limit(1);

            if (!clientRecord.length) {
                throw new Error('Client not found');
            }

            const scopes = token.scope || client.scopes || [];
            await db.insert(oauthTokens).values({
                organizationId: client.organizationId,
                clientId: clientRecord[0].id,
                accessToken: token.accessToken,
                refreshToken: token.refreshToken || null,
                scopes: JSON.stringify(Array.isArray(scopes) ? scopes : [scopes]),
                expiresAt: token.accessTokenExpiresAt,
                createdAt: new Date(),
            });

            return {
                accessToken: token.accessToken,
                accessTokenExpiresAt: token.accessTokenExpiresAt,
                refreshToken: token.refreshToken,
                refreshTokenExpiresAt: token.refreshTokenExpiresAt,
                scope: Array.isArray(scopes) ? scopes : [scopes],
                client,
                user,
            };
        } catch (error) {
            console.error('OAuth saveToken error:', error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    /**
     * Retrieve an access token by token string
     * Required for protected resource requests
     */
    async getAccessToken(bearerToken: string): Promise<OAuthToken | null> {
        try {
            // Validate token format
            if (!this.validateInput('token', bearerToken)) {
                return null;
            }

            const result = await db
                .select({
                    accessToken: oauthTokens.accessToken,
                    expiresAt: oauthTokens.expiresAt,
                    scopes: oauthTokens.scopes,
                    clientId: oauthClients.clientId,
                    organizationId: oauthClients.organizationId,
                    grants: oauthClients.grants,
                    clientScopes: oauthClients.scopes,
                })
                .from(oauthTokens)
                .innerJoin(oauthClients, eq(oauthTokens.clientId, oauthClients.id))
                .where(eq(oauthTokens.accessToken, bearerToken))
                .limit(1);

            if (!result.length) {
                return null;
            }

            const token = result[0];

            // Atomic check and update to prevent race conditions
            const now = new Date();
            if (token.expiresAt < now) {
                // Clean up expired token atomically
                await db
                    .delete(oauthTokens)
                    .where(
                        and(
                            eq(oauthTokens.accessToken, bearerToken),
                            lt(oauthTokens.expiresAt, now)
                        )
                    );
                return null;
            }

            // Update last used timestamp atomically with expiry check
            await db
                .update(oauthTokens)
                .set({lastUsedAt: now})
                .where(
                    and(
                        eq(oauthTokens.accessToken, bearerToken),
                        lt(now, oauthTokens.expiresAt) // Double-check not expired
                    )
                );

            return {
                accessToken: token.accessToken,
                accessTokenExpiresAt: token.expiresAt,
                scope: this.safeJsonParse(token.scopes, []),
                client: {
                    id: token.clientId,
                    organizationId: token.organizationId,
                    grants: this.safeJsonParse(token.grants, ['client_credentials']),
                    scopes: this.safeJsonParse(token.clientScopes, ['read', 'write']),
                },
            };
        } catch (error) {
            // Log security event for audit trail
            console.error('OAuth getAccessToken security event', {
                tokenPrefix: bearerToken?.substring(0, 8) + '...',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.name : 'Unknown error'
            });
            return null;
        }
    }

    /**
     * Revoke an access token
     * Used for token cleanup and logout
     */
    async revokeToken(token: { accessToken: string }): Promise<boolean> {
        try {
            // Validate token format
            if (!this.validateInput('token', token.accessToken)) {
                return false;
            }

            await db
                .delete(oauthTokens)
                .where(eq(oauthTokens.accessToken, token.accessToken));

            return true;
        } catch (error) {
            console.error('OAuth revokeToken error:', error instanceof Error ? error.message : 'Unknown error');
            return false;
        }
    }

    /**
     * Generate a cryptographically secure access token
     * Uses 512 bits of entropy as per financial industry standards
     */
    generateAccessToken(): string {
        return crypto.randomBytes(64).toString('hex'); // 512 bits
    }

    /**
     * Generate a cryptographically secure refresh token
     * Uses 512 bits of entropy as per financial industry standards
     */
    generateRefreshToken(): string {
        return crypto.randomBytes(64).toString('hex'); // 512 bits
    }

    /**
     * Clean up expired tokens (utility method)
     * Should be called periodically via cron job
     */
    async cleanupExpiredTokens(): Promise<number> {
        try {
            // Delete tokens that expired before current time
            await db
                .delete(oauthTokens)
                .where(lt(oauthTokens.expiresAt, new Date()));

            console.log('OAuth expired tokens cleaned up');
            return 0; // Drizzle doesn't return affected rows count directly
        } catch (error) {
            console.error('OAuth cleanup error:', error instanceof Error ? error.message : 'Unknown error');
            return 0;
        }
    }

    /**
     * Hash client secret for storage
     * Utility method for creating clients
     */
    async hashClientSecret(secret: string): Promise<string> {
        return bcrypt.hash(secret, this.SALT_ROUNDS);
    }

    /**
     * Generate a secure client ID
     * Utility method for creating clients
     */
    generateClientId(): string {
        return `client_${crypto.randomBytes(16).toString('hex')}`;
    }

    /**
     * Generate a secure client secret
     * Utility method for creating clients
     */
    generateClientSecret(): string {
        return crypto.randomBytes(32).toString('base64url');
    }
}