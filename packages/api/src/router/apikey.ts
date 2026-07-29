import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { auth } from "@padock/auth";
import { sessionProcedure, router } from "../trpc.ts";

// PAT 細粒度權限 (Phase 6, CONTEXT.md §6/§9): `scopes` is a flat list of
// "resource:action" pairs (e.g. "task:read"), grouped here into the
// Record<string, string[]> shape Better Auth's api-key plugin stores.
// Omitted/empty means an unscoped (full-access) key — today's default,
// unchanged. `permissions`/`userId` are server-only fields on
// createApiKey (Better Auth throws SERVER_ONLY_PROPERTY if this were a
// raw HTTP passthrough) — this only works because we call
// auth.api.createApiKey directly from server code, not by forwarding
// a client request.
export const apikeyRouter = router({
  create: sessionProcedure
    .input(
      z.object({
        name: z.string().min(1),
        scopes: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let permissions: Record<string, string[]> | undefined;
      if (input.scopes && input.scopes.length > 0) {
        permissions = {};
        for (const entry of input.scopes) {
          const [resource, action] = entry.split(":");
          if (!resource || !action) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid scope "${entry}", expected "resource:action"`,
            });
          }
          (permissions[resource] ??= []).push(action);
        }
      }

      const result = await auth.api.createApiKey({
        body: {
          name: input.name,
          userId: ctx.user.id,
          ...(permissions ? { permissions } : {}),
        },
      });

      return {
        key: result.key,
        id: result.id,
        name: result.name,
        permissions: result.permissions ?? null,
      };
    }),
});
