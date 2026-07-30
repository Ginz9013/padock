import { initTRPC, TRPCError } from "@trpc/server";
import { resolveIdentity, type ResolvedIdentity } from "@padock/auth";
import { prisma } from "@padock/db";
import type { PrismaClient } from "@padock/db";

interface Context {
  db: PrismaClient;
  identity: ResolvedIdentity | null;
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<Context> {
  const identity = await resolveIdentity(opts.headers);
  return { db: prisma, identity };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.identity) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.identity.user,
      authMethod: ctx.identity.authMethod,
      scopes: ctx.identity.scopes,
      unattended: ctx.identity.unattended,
    },
  });
});

/**
 * PAT 細粒度權限 (Phase 6, CONTEXT.md §6/§9): gates a procedure behind a
 * resource:action pair. `ctx.scopes === null` means unrestricted
 * (session auth, or a PAT created with no `permissions` — backward
 * compatible with every key issued before this phase).
 */
export function scopedProcedure(resource: string, action: "read" | "write") {
  return protectedProcedure.use(({ ctx, next }) => {
    if (ctx.scopes !== null && !ctx.scopes[resource]?.includes(action)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `API key lacks '${action}' scope for '${resource}'`,
      });
    }
    return next({ ctx });
  });
}

/**
 * Key issuance is a human-only action (matches `login`/`init-skill`
 * already being excluded from the agent-facing command grammar): no
 * API key, scoped or not, may mint another key. Closes the
 * self-escalation path outright instead of needing subset checks.
 */
export const sessionProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.authMethod !== "session") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires a browser session, not an API key.",
    });
  }
  return next({ ctx });
});
