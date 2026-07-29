import { initTRPC, TRPCError } from "@trpc/server";
import { resolveIdentity, type PadockUser } from "@padock/auth";
import { prisma } from "@padock/db";
import type { PrismaClient } from "@padock/db";

interface Context {
  db: PrismaClient;
  user: PadockUser | null;
}

export async function createTRPCContext(opts: { headers: Headers }): Promise<Context> {
  const user = await resolveIdentity(opts.headers);
  return { db: prisma, user };
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
