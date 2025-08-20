import { createAuthClient } from "better-auth/client";
import { 
  organizationClient, 
  apiKeyClient, 
  twoFactorClient, 
  adminClient 
} from "better-auth/client/plugins";
import type { auth } from "./auth";

// Construct base URL using Vercel environment variables (client-side)
const baseURL = typeof window !== "undefined" 
  ? window.location.origin
  : process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: `${baseURL}/api/auth`,
  
  plugins: [
    // Organization management with role-based permissions
    organizationClient(),
    
    // API key management
    apiKeyClient(),
    
    // Two-factor authentication
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // Redirect to 2FA verification page
        if (typeof window !== "undefined") {
          window.location.href = "/auth/2fa";
        }
      },
    }),
    
    // Admin functionality
    adminClient(),
  ],
  
  fetchOptions: {
    onError: (ctx) => {
      // Handle authentication errors globally
      if (ctx.response.status === 401) {
        // Redirect to login page on unauthorized
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth/signin";
        }
      }
    },
  },
});

// Export types for use in other files
export type AuthClient = typeof authClient;
export type Session = typeof authClient.$Infer.Session;