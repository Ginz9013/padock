import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@padock/auth";
import { prisma } from "@padock/db";
import type { PrismaClient } from "@padock/db";

interface Context {
  db: PrismaClient;
  user: { id: string; email: string; name: string } | null;
}

/**
 * Resolves identity from either auth source into one context shape:
 * browser session cookie, or a CLI-issued API key (x-api-key header).
 * See CONTEXT.md §5.1.1 — Better Auth's own session-for-API-key mocking
 * is intentionally left off (it's marked not-production-safe upstream);
 * we verify the key explicitly instead.
 */
export async function createTRPCContext(opts: { headers: Headers }): Promise<Context> {
  const session = await auth.api.getSession({ headers: opts.headers });
  if (session) {
    return { db: prisma, user: session.user };
  }

  const apiKey = opts.headers.get("x-api-key");
  if (apiKey) {
    const result = await auth.api.verifyApiKey({ body: { key: apiKey } });
    if (result.valid && result.key) {
      const user = await prisma.user.findUnique({ where: { id: result.key.referenceId } });
      if (user) {
        return { db: prisma, user };
      }
    }
  }

  return { db: prisma, user: null };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
