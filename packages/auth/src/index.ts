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
  plugins: [organization(), apiKey()],
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
 * The one identity-resolution seam every process role (web/realtime/
 * worker) shares — CONTEXT.md §5.1.1. Tries a browser session cookie
 * first, then falls back to the `x-api-key` header (a CLI's PAT),
 * verified explicitly via `verifyApiKey` rather than Better Auth's
 * `enableSessionForAPIKeys` flag, which upstream marks as not
 * production-safe.
 */
export async function resolveIdentity(headers: Headers): Promise<PadockUser | null> {
  const session = await auth.api.getSession({ headers });
  if (session) {
    return session.user;
  }

  const key = headers.get("x-api-key");
  if (key) {
    const result = await auth.api.verifyApiKey({ body: { key } });
    if (result.valid && result.key) {
      const user = await prisma.user.findUnique({ where: { id: result.key.referenceId } });
      if (user) {
        return user;
      }
    }
  }

  return null;
}
