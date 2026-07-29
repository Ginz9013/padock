import { version } from "../../../../package.json";

// CONTEXT.md §5.1.1's version skew guard: the CLI compares this
// against its own package.json version and warns on mismatch.
export function GET() {
  return Response.json({ version });
}
