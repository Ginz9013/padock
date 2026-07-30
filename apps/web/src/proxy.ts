import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Decision (grill-with-docs, Phase 7 web UI): route protection lives here,
// not in page rendering mode — every page stays a Client Component
// (CONTEXT.md §6, "Rendering model"). This only checks that a session
// cookie is present (cheap, no DB hit); actual authorization still runs
// server-side per tRPC call via resolveIdentity (packages/auth).
const ANON_ONLY_PATHS = ["/", "/login", "/register"];
const PROTECTED_PREFIXES = ["/dashboard", "/approvals"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (hasSession && ANON_ONLY_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!hasSession && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/dashboard/:path*", "/approvals/:path*"],
};
