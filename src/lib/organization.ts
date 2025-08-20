import {auth} from "./auth";
import {db} from "@/db/connection";
import {organization} from "@/db/schema";
import {eq} from "drizzle-orm";

/**
 * Organization management utilities for BetterAuth integration
 */

// Type definitions for organization operations
export interface CreateOrganizationData {
    name: string;
    slug: string;
    description?: string;
    userId: string;
}

export interface OrganizationMember {
    userId: string;
    organizationId: string;
    role: 'accountant' | 'auditor' | 'admin' | 'integration-bot';
    invitedBy?: string;
}

/**
 * Create a new organization with initial setup
 */
export async function createOrganizationWithSetup(data: CreateOrganizationData) {
    try {
        // Create the organization using BetterAuth
        const result = await auth.api.createOrganization({
            body: {
                name: data.name,
                slug: data.slug,
                description: data.description,
            },
            headers: {
                // TODO: Add proper authentication headers
            }
        });

        // TODO: Set up default accounts, periods, etc. for the new organization
        console.log(`Organization ${data.name} created successfully`);

        return result;
    } catch (error) {
        console.error('Error creating organization:', error);
        throw error;
    }
}

/**
 * Get user's organizations with roles
 */
export async function getUserOrganizations(userId: string) {
    try {
        // Get organizations where user is a member
        const userOrgs = await auth.api.listUserOrganizations({
            headers: {
                // TODO: Add proper authentication headers
            }
        });

        return userOrgs;
    } catch (error) {
        console.error('Error fetching user organizations:', error);
        throw error;
    }
}

/**
 * Set the current organization context for RLS
 */
export function setCurrentOrganization(organizationId: string) {
    // This will be used by our RLS policies
    // For now, we'll handle this in the middleware
    return organizationId;
}

/**
 * Get organization by ID
 */
export async function getOrganization(organizationId: string) {
    try {
        const org = await db
            .select()
            .from(organization)
            .where(eq(organization.id, organizationId))
            .limit(1);

        return org[0] || null;
    } catch (error) {
        console.error('Error fetching organization:', error);
        return null;
    }
}

/**
 * Check if user has permission in organization
 */
export async function checkUserPermission(
    userId: string,
    organizationId: string,
    permission: 'read' | 'write' | 'admin'
) {
    try {
        // Use BetterAuth to check organization membership and roles
        const membership = await auth.api.getUserOrganizationRole({
            headers: {
                // TODO: Add proper authentication headers
            }
        });

        // TODO: Implement permission checking logic based on roles
        return true; // Placeholder
    } catch (error) {
        console.error('Error checking user permission:', error);
        return false;
    }
}