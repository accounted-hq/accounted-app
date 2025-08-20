import {NextRequest, NextResponse} from 'next/server';
import {auth} from './auth';

/**
 * Authentication and authorization middleware for API routes
 */

export interface AuthContext {
    user?: {
        id: string;
        email: string;
        name: string;
        role?: string;
    };
    organizationId?: string;
    organizationRole?: string;
    apiKey?: {
        id: string;
        name: string;
        organizationId: string;
    };
}

/**
 * Extract authentication context from request
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
    try {
        // Check for session-based authentication
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (session?.user) {
            return {
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.name,
                    role: session.user.role,
                },
                organizationId: session.session.activeOrganizationId || undefined,
                // TODO: Get organization role from BetterAuth
            };
        }

        // Check for API key authentication
        const authorization = request.headers.get('authorization');
        if (authorization?.startsWith('Bearer ')) {
            const token = authorization.slice(7);

            const apiKeyAuth = await auth.api.validateAPIKey({
                body: {key: token},
                headers: request.headers,
            });

            if (apiKeyAuth) {
                return {
                    apiKey: {
                        id: apiKeyAuth.id,
                        name: apiKeyAuth.name,
                        organizationId: apiKeyAuth.organizationId,
                    },
                    organizationId: apiKeyAuth.organizationId,
                };
            }
        }

        return null;
    } catch (error) {
        console.error('Error getting auth context:', error);
        return null;
    }
}

/**
 * Middleware to check if user is authenticated
 */
export async function requireAuth(
    request: NextRequest,
    handler: (context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
    const authContext = await getAuthContext(request);

    if (!authContext) {
        return NextResponse.json(
            {
                code: 'UNAUTHORIZED',
                message: 'Authentication required'
            },
            {status: 401}
        );
    }

    return handler(authContext);
}

/**
 * Middleware to check organization access
 */
export async function requireOrganization(
    request: NextRequest,
    handler: (context: AuthContext & { organizationId: string }) => Promise<NextResponse>
): Promise<NextResponse> {
    return requireAuth(request, async (authContext) => {
        if (!authContext.organizationId) {
            return NextResponse.json(
                {
                    code: 'NO_ORGANIZATION',
                    message: 'Organization context required'
                },
                {status: 403}
            );
        }

        return handler({...authContext, organizationId: authContext.organizationId});
    });
}

/**
 * Middleware to check specific roles
 */
export async function requireRole(
    roles: string[],
    request: NextRequest,
    handler: (context: AuthContext) => Promise<NextResponse>
): Promise<NextResponse> {
    return requireAuth(request, async (authContext) => {
        const userRole = authContext.organizationRole || authContext.user?.role;

        if (!userRole || !roles.includes(userRole)) {
            return NextResponse.json(
                {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: `Required roles: ${roles.join(', ')}`
                },
                {status: 403}
            );
        }

        return handler(authContext);
    });
}

/**
 * Set up RLS context for database queries
 */
export function setupRLSContext(organizationId: string, userId?: string) {
    // This will be called before database operations to set up RLS context
    // Implementation depends on how we set up the database connection per request
    return {
        organizationId,
        userId,
    };
}

/**
 * Create standard error response
 */
export function createErrorResponse(code: string, message: string, status: number = 400) {
    return NextResponse.json(
        {code, message},
        {status}
    );
}

/**
 * Create success response with consistent format
 */
export function createSuccessResponse(data: any, status: number = 200) {
    return NextResponse.json(data, {status});
}