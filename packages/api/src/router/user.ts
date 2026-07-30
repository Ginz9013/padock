import { scopedProcedure, router } from "../trpc.ts";

// Single-tenant (CONTEXT.md §6): every user belongs to the one
// Organization, so this is just "everyone" — needed so a chat sender
// (or the future CLI) can discover valid recipient ids.
export const userRouter = router({
  list: scopedProcedure("user", "read").query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });
  }),
});
