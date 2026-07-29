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
});
