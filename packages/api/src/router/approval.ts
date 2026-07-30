import { z } from "zod";
import { TRPCError, callTRPCProcedure } from "@trpc/server";
import type { AnyRouter } from "@trpc/server";
import type { Prisma } from "@padock/db";
import { sessionProcedure, protectedProcedure, router } from "../trpc.ts";

// Phase 6b: reviewing/deciding pending writes from unattended PATs
// (packages/api/src/approvalGate.ts). `list`/`approve`/`reject` are
// session-only (the web /approvals page, org-wide review queue) — same
// human-only reasoning as apikey.create, an API key can't approve its
// own or anyone else's queued write. `mine`/`status` are for the agent
// itself (CLI/MCP, API-key auth) to check on its own submissions.
export const approvalRouter = router({
  list: sessionProcedure.query(async ({ ctx }) => {
    return ctx.db.approvalRequest.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "desc" },
    });
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.approvalRequest.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }),

  status: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.approvalRequest.findFirst({
        where: { id: input.id, userId: ctx.user.id },
      });
      if (!request) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return request;
    }),

  approve: sessionProcedure
    .input(z.object({ id: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.approvalRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (request.status !== "pending") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Already ${request.status}` });
      }
      const owner = await ctx.db.user.findUniqueOrThrow({ where: { id: request.userId } });

      // Dynamic import avoids a circular import with root.ts (which
      // imports this file to mount `approval`) — by the time this
      // resolver actually runs, root.ts has finished initializing.
      // Cast to AnyRouter (type erasure): letting TS infer through the
      // dynamic import's real type here would make AppRouter's own
      // type definition reference itself (approve's return type ->
      // callTRPCProcedure's generic bound to AppRouter -> AppRouter),
      // which blows the compiler's instantiation depth in consumers
      // (surfaced as apps/web's tsc failing with TS2589).
      const { appRouter } = await import("../root.ts");
      const result: unknown = await callTRPCProcedure({
        router: appRouter as AnyRouter,
        path: request.path,
        type: "mutation",
        // Full access, unattended:false — a human already reviewed the
        // actual content, so re-running the original resource-scope
        // check adds no safety, only friction. unattended:true here
        // would re-queue instead of ever executing (infinite deferral).
        ctx: {
          db: ctx.db,
          identity: { user: owner, authMethod: "apikey" as const, scopes: null, unattended: false },
        },
        input: request.input,
        getRawInput: async () => request.input,
        signal: undefined,
        batchIndex: 0,
      });

      return ctx.db.approvalRequest.update({
        where: { id: input.id },
        data: {
          status: "approved",
          result: result as Prisma.InputJsonValue,
          decidedById: ctx.user.id,
          decidedAt: new Date(),
          note: input.note,
        },
      });
    }),

  reject: sessionProcedure
    .input(z.object({ id: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.approvalRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (request.status !== "pending") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Already ${request.status}` });
      }
      return ctx.db.approvalRequest.update({
        where: { id: input.id },
        data: { status: "rejected", decidedById: ctx.user.id, decidedAt: new Date(), note: input.note },
      });
    }),
});
