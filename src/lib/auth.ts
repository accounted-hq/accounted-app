import {betterAuth} from "better-auth";
import {
    admin,
    apiKey,
    bearer,
    organization as organizationPlugin,
    twoFactor as twoFactorPlugin
} from "better-auth/plugins";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import {db} from "@/db/connection";
import {account, apikey, invitation, member, organization, session, twoFactor, user, verification} from "@/db/schema";
import {emailService} from '@/lib/email';

// Construct base URL using Vercel environment variables
const baseURL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NODE_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : "https://accounted-app.vercel.app" // fallback
        : "http://localhost:8888";

// BetterAuth specific schema - only include auth-related tables
const authSchema = {
    user,
    session,
    account,
    verification,
    organization,
    member,
    invitation,
    apikey,
    twoFactor,
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
      schema: authSchema,
  }),
  
  // Required secret for JWT signing
    secret: process.env.BETTER_AUTH_SECRET || "dev-secret-change-in-production",

    appName: "Accounted App",
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12, // Enterprise security
    sendResetPassword: async ({ user, url, token }, request) => {
        if (emailService) {
            try {
                const result = await emailService.sendPasswordReset({
                    user: {email: user.email, name: user.name},
                    url,
                    token
                });

                if (!result.success) {
                    console.error('❌ Failed to send password reset email:', result.error?.message);
                    // Fallback to console log for development
                    console.log(`🔧 [DEV] Password reset for ${user.email}: ${url}`);
                } else {
                    console.log(`✅ Password reset email sent successfully (${result.messageId})`);
                }
            } catch (error) {
                console.error('❌ Error sending password reset email:', error);
                // Fallback to console log
                console.log(`Password reset for ${user.email}: ${url}`);
            }
        } else {
            // Fallback when email service is not configured
            console.log(`🔧 [DEV] Password reset for ${user.email}: ${url}`);
        }
    },
  },
  
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
        if (emailService) {
            try {
                const result = await emailService.sendEmailVerification({
                    user: {email: user.email, name: user.name},
                    url,
                    token
                });

                if (!result.success) {
                    console.error('❌ Failed to send email verification:', result.error?.message);
                    // Fallback to console log for development
                    console.log(`🔧 [DEV] Email verification for ${user.email}: ${url}`);
                } else {
                    console.log(`✅ Email verification sent successfully (${result.messageId})`);
                }
            } catch (error) {
                console.error('❌ Error sending email verification:', error);
                // Fallback to console log
                console.log(`Email verification for ${user.email}: ${url}`);
            }
        } else {
            // Fallback when email service is not configured
            console.log(`🔧 [DEV] Email verification for ${user.email}: ${url}`);
        }
    },
  },
  
  plugins: [
    // Multi-tenancy with role-based access control
      organizationPlugin({
      allowUserToCreateOrganization: async (user) => {
        // Only allow admins to create organizations initially
        // This can be customized based on business logic
        return true; // For now, allow all users
      },
      organizationCreation: {
        beforeCreate: async ({ organization, user }, request) => {
          // Custom validation or setup logic before org creation
          return { data: organization };
        },
        afterCreate: async ({ organization, member, user }, request) => {
          // Set up default accounts, periods, etc. for new organization
          console.log(`Organization created: ${organization.name} by ${user.email}`);
        }
      },
    }),
    
    // API Key authentication for external integrations
    apiKey(),
    
    // Two-factor authentication for enhanced security
      twoFactorPlugin({
          issuer: "Accounted App",
    }),
    
    // Admin plugin for user management
    admin(),
    
    // Bearer token support for API authentication
    bearer(),
  ],
  
  // Security settings
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session daily
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 * 1000, // 5 minutes
    },
  },
  
  // Advanced security
  advanced: {
    crossSubDomainCookies: {
      enabled: false, // Disable for security
    },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  
  // Rate limiting (basic)
  rateLimit: {
    window: 60, // 1 minute
    max: 100, // 100 requests per minute
  },
  
  // Trusted origins using Vercel environment variables
  trustedOrigins: [
    baseURL,
    // Add preview deployments on Vercel
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    // Local development
      "http://localhost:8888",
  ].filter(Boolean),
  
  baseURL,
  
  logger: {
    level: process.env.NODE_ENV === "production" ? "warn" : "info",
  },
});

// Export the type for use in other files
export type AuthSession = typeof auth.$Infer.Session;