import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages (@padock/*) are consumed as TS source, not
  // pre-built dist — Next.js needs to transpile them explicitly since
  // they resolve through node_modules via pnpm's symlinks.
  transpilePackages: ["@padock/api", "@padock/auth", "@padock/db"],
};

export default nextConfig;
