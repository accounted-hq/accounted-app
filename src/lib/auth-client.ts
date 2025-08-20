import {createAuthClient} from "better-auth/client";
import {adminClient, organizationClient, twoFactorClient} from "better-auth/client/plugins";

/**
 * Client-side authentication utilities for BetterAuth
 */

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:8888",
  plugins: [
    organizationClient(),
      twoFactorClient(),
    adminClient(),
  ],
});

// Export common auth functions for easier use
export const {
    signUp,
    signIn,
    signOut,
    getSession,
    user,
    organization,
    twoFactor,
} = authClient;

// Type exports
export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.User;

/**
 * Custom hooks and utilities
 */

// Check if user is authenticated
export function useAuth() {
    return authClient.useSession();
}

// Get current organization
export function useOrganization() {
    return authClient.useActiveOrganization();
}

// Organization management helpers
export const organizationActions = {
    create: async (data: { name: string; slug: string; description?: string }) => {
        return authClient.organization.create(data);
    },

    invite: async (organizationId: string, email: string, role: string) => {
        return authClient.organization.inviteMember({
            organizationId,
            email,
            role,
        });
    },

    setActive: async (organizationId: string) => {
        return authClient.organization.setActive({organizationId});
    },

    leave: async (organizationId: string) => {
        return authClient.organization.leave({organizationId});
    },
};

// Two-factor authentication helpers
export const twoFactorActions = {
    enable: async () => {
        return authClient.twoFactor.enable();
    },

    disable: async () => {
        return authClient.twoFactor.disable();
    },

    verify: async (code: string) => {
        return authClient.twoFactor.verify({code});
    },
};

// API Key management (for integration accounts)
export const apiKeyActions = {
    create: async (name: string, organizationId?: string) => {
        return authClient.createAPIKey({
            name,
            organizationId,
        });
    },

    list: async () => {
        return authClient.listAPIKeys();
    },

    revoke: async (keyId: string) => {
        return authClient.revokeAPIKey({keyId});
    },
};

// Utility functions
export const authUtils = {
    // Check if user has specific role in organization
    hasRole: (session: Session | null, role: string, organizationId?: string): boolean => {
        if (!session?.user) return false;

        // TODO: Implement proper role checking with organization context
        return true; // Placeholder
    },

    // Get user's role in current organization
    getCurrentRole: (session: Session | null): string | null => {
        // TODO: Extract role from session organization data
        return session?.user?.role || null;
    },

    // Check if user is admin
    isAdmin: (session: Session | null): boolean => {
        return authUtils.hasRole(session, 'admin');
    },

    // Check if user can perform accounting operations
    canDoAccounting: (session: Session | null): boolean => {
        return authUtils.hasRole(session, 'accountant') || authUtils.hasRole(session, 'admin');
    },

    // Format user display name
    getUserDisplayName: (user: User | null): string => {
        if (!user) return 'Unknown User';
        return user.name || user.email || 'Unknown User';
    },
};