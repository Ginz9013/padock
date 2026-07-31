import { initTRPC, TRPCError } from "@trpc/server";
import { resolveIdentity, type ResolvedIdentity } from "@padock/auth";
import { prisma } from "@padock/db";
import type { PrismaClient, Prisma } from "@padock/db";

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
 * Cross-domain audit trail (CONTEXT.md §4, schema.prisma's `AuditLog`
 * doc comment). Shared by every write path instead of called per
 * resolver, so a new domain/procedure can't forget to log itself.
 * Only called after `next()` has already succeeded — a rejected or
 * throwing call never reaches here, matching ApprovalRequest's own
 * "record the request, not failed attempts" precedent. `queued`
 * reflects `ctx.unattended` at call time, not the result shape: an
 * unattended write is logged once now (queued=true, nothing actually
 * ran yet — runOrQueue diverted it to ApprovalRequest) and again when
 * a human's approval replays it for real (queued=false) — two
 * distinct events at two distinct times, not a duplicate.
 *
 * Takes `getRawInput` rather than a plain `input` value on purpose:
 * `.input(zodSchema)` compiles down to its own middleware, spliced
 * into the chain at the point it's declared (verified by reading
 * @trpc/server's `createInputMiddleware` directly). Every router here
 * calls `scopedProcedure(...).input(zodSchema).mutation(...)`, i.e.
 * `.input()` comes *after* `scopedProcedure`'s own `.use()` in the
 * chain, so the parsed `input` middleware arg isn't populated yet at
 * this point — only `getRawInput()` (available at any position) is.
 * Logs the pre-zod payload rather than the post-parse one as a result;
 * for this codebase's schemas (plain z.object() over primitives, no
 * .transform()) the two are structurally identical in practice.
 */
async function writeAuditLog(
  ctx: { db: PrismaClient; user: { id: string }; authMethod: string; unattended: boolean },
  path: string,
  getRawInput: () => Promise<unknown>,
) {
  await ctx.db.auditLog.create({
    data: {
      actorId: ctx.user.id,
      authMethod: ctx.authMethod,
      path,
      input: (await getRawInput()) as Prisma.InputJsonValue,
      queued: ctx.unattended,
    },
  });
}

/**
 * PAT 細粒度權限 (Phase 6, CONTEXT.md §6/§9): gates a procedure behind a
 * resource:action pair. `ctx.scopes === null` means unrestricted
 * (session auth, or a PAT created with no `permissions` — backward
 * compatible with every key issued before this phase). Also the audit
 * log's main entry point: every "write" call that gets past the scope
 * check and actually succeeds is logged (see `writeAuditLog` above).
 */
export function scopedProcedure(resource: string, action: "read" | "write") {
  return protectedProcedure.use(async ({ ctx, next, path, getRawInput }) => {
    if (ctx.scopes !== null && !ctx.scopes[resource]?.includes(action)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `API key lacks '${action}' scope for '${resource}'`,
      });
    }
    const result = await next({ ctx });
    if (action === "write" && result.ok) {
      await writeAuditLog(ctx, path, getRawInput);
    }
    return result;
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

/**
 * `sessionProcedure` doesn't take a resource/action pair the way
 * `scopedProcedure` does (§6/§9's per-domain scoping doesn't apply to
 * these — they're the human-only escape hatch), so the three write
 * endpoints that live outside `scopedProcedure` entirely (apikey
 * issuance, approval decisions) can't share its audit-log branch.
 * Same `writeAuditLog` call, applied unconditionally since every use
 * of this builder is already a write.
 */
export const auditedSessionProcedure = sessionProcedure.use(async ({ ctx, next, path, getRawInput }) => {
  const result = await next({ ctx });
  if (result.ok) {
    await writeAuditLog(ctx, path, getRawInput);
  }
  return result;
});
