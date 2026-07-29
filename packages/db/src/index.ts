import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

export { PrismaClient };

declare global {
  // eslint-disable-next-line no-var
  var __padockPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads / turbo watch restarts in dev.
export const prisma = globalThis.__padockPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__padockPrisma = prisma;
}
