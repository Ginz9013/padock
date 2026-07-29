import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { organization } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { prisma } from "@padock/db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization(),
    // Default rate limit is 10 requests/day per key — fine for a
    // multi-tenant SaaS guarding against abuse, but wrong for Padock's
    // v1 threat model (§6/§7): a PAT already grants full permission
    // and every action is human-approved in the same session, so
    // there's nothing an artificial request quota adds. Disabled, not
    // just raised, since there's no rate-limit-shaped problem here yet.
    apiKey({ rateLimit: { enabled: false } }),
  ],
  databaseHooks: {
    user: {
      create: {
        // Single-tenant bootstrap (CONTEXT.md §6): one Padock instance
        // = one organization. The first sign-up creates it and becomes
        // owner; everyone after just joins as a member. Plain Prisma
        // calls, not the organization plugin's multi-org API — there's
        // only ever one org here, no creation/switching UX needed.
        after: async (user) => {
          const existingOrg = await prisma.organization.findFirst();
          if (!existingOrg) {
            const org = await prisma.organization.create({
              data: {
                id: crypto.randomUUID(),
                name: process.env["PADOCK_ORG_NAME"] ?? "Padock",
                slug: "padock",
                createdAt: new Date(),
              },
            });
            await prisma.member.create({
              data: {
                id: crypto.randomUUID(),
                organizationId: org.id,
                userId: user.id,
                role: "owner",
                createdAt: new Date(),
              },
            });
          } else {
            await prisma.member.create({
              data: {
                id: crypto.randomUUID(),
                organizationId: existingOrg.id,
                userId: user.id,
                role: "member",
                createdAt: new Date(),
              },
            });
          }
        },
      },
    },
  },
});

export type PadockUser = { id: string; email: string; name: string };

/**
 * `scopes: null` means unrestricted — either a browser session (no PAT
 * scoping concept applies) or a PAT created with no `permissions` set
 * (today's default, kept backward compatible per CONTEXT.md §6). A
 * non-null record restricts the key to the listed resource:action
 * pairs (Phase 6 — PAT 細粒度權限).
 */
export type ResolvedIdentity = {
  user: PadockUser;
  authMethod: "session" | "apikey";
  scopes: Record<string, string[]> | null;
};

/**
 * The one identity-resolution seam every process role (web/realtime/
 * worker) shares — CONTEXT.md §5.1.1. Tries a browser session cookie
 * first, then falls back to the `x-api-key` header (a CLI's PAT),
 * verified explicitly via `verifyApiKey` rather than Better Auth's
 * `enableSessionForAPIKeys` flag, which upstream marks as not
 * production-safe.
 */
export async function resolveIdentity(headers: Headers): Promise<ResolvedIdentity | null> {
  const session = await auth.api.getSession({ headers });
  if (session) {
    return { user: session.user, authMethod: "session", scopes: null };
  }

  const key = headers.get("x-api-key");
  if (key) {
    const result = await auth.api.verifyApiKey({ body: { key } });
    if (result.valid && result.key) {
      const user = await prisma.user.findUnique({ where: { id: result.key.referenceId } });
      if (user) {
        return { user, authMethod: "apikey", scopes: result.key.permissions ?? null };
      }
    }
  }

  return null;
}
