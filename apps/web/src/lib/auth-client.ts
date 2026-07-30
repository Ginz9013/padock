import { createAuthClient } from "better-auth/react";

// Paired frontend half of packages/auth/src/index.ts's server config —
// same email/password + organization setup, just the React-side client
// (useSession, signIn, signUp, signOut) instead of hand-rolled fetch
// calls to /api/auth/*.
export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});

export const { useSession, signIn, signUp, signOut } = authClient;
