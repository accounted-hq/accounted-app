import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Export all HTTP methods that BetterAuth supports
const { GET, POST } = toNextJsHandler(auth);

export { GET, POST };