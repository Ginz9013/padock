"use client";

import { useRouter } from "next/navigation";

import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AppSidebar } from "@/components/app-sidebar";

// Sidebar-first shell, not a top-nav bar (this session's UX decision,
// CONTEXT.md §5's UX shell): the app is organized by "where you are"
// (Dashboard / a Project) rather than by domain module, so the
// project list belongs in the persistent nav, not a dropdown.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          {session?.user && (
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
