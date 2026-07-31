"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { PanelLeftOpen, PanelRightOpen } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { authClient, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatSidebarProvider } from "@/components/chat/chat-sidebar-provider";
import { ChatRightSidebar } from "@/components/chat/chat-right-sidebar";

type Project = { id: string; name: string };

// Sidebar-first shell, not a top-nav bar (this session's UX decision,
// CONTEXT.md §5's UX shell): the app is organized by "where you are"
// (Dashboard / a Project) rather than by domain module, so the
// project list belongs in the persistent nav, not a dropdown.
//
// Three-column row (left AppSidebar / main content / right chat
// sidebar) sits *below* a full-width header, not beside it — the
// header spans the whole viewport width; only the row underneath is
// split into columns. Both side panels are resizable-by-drag and
// collapsible via a toggle button in their own top bar (not the app
// header), using react-resizable-panels (shadcn's `resizable`) rather
// than shadcn's `Sidebar` primitive: Sidebar only toggles between
// fixed preset widths, it has no drag-to-resize, which this needed
// alongside the collapse button. Collapsing shrinks a panel to zero
// width, so there's nothing left in the row to click to reopen it —
// a floating button anchored to that corner of the row covers that
// case.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { id: projectId } = useParams<{ id?: string }>();
  const { data: session } = useSession();
  const leftPanelRef = useRef<PanelImperativeHandle>(null);
  const chatPanelRef = useRef<PanelImperativeHandle>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const previousPathnameRef = useRef(pathname);

  // Entering a project (from outside it) auto-collapses the chat sidebar to
  // give the project view more room; navigating within/between project pages
  // afterwards leaves the user's own open/close choice alone.
  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    const enteringProject =
      !previousPathname.startsWith("/projects/") && pathname.startsWith("/projects/");
    if (enteringProject) {
      chatPanelRef.current?.collapse();
    }
  }, [pathname]);

  // Project title lives here (not in projects/[id]/layout.tsx) so it can
  // sit in a persistent sub-header row rather than scrolling away with
  // page content — this component already owns the row that splits into
  // sidebar/main/sidebar columns, so the sub-header naturally inherits
  // the main column's width instead of the full-width app header's.
  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjectName(null);
      return;
    }
    trpc.project.list.query().then((projects) => {
      setProjectName((projects as Project[]).find((p) => p.id === projectId)?.name ?? null);
    });
  }, [projectId]);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  const toggleLeftSidebar = useCallback(() => {
    const panel = leftPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);

  const toggleChatSidebar = useCallback(() => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);

  return (
    <ChatSidebarProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="flex w-full shrink-0 items-center justify-between gap-3 border-b px-6 py-3">
          <Link href="/dashboard" className="font-heading text-sm font-semibold">
            Padock
          </Link>
          <div className="flex items-center gap-3">
            {session?.user && (
              <span className="text-sm text-muted-foreground">{session.user.email}</span>
            )}
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </header>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
            <ResizablePanel
              panelRef={leftPanelRef}
              collapsible
              collapsedSize="0"
              minSize="14"
              maxSize="28"
              defaultSize="18"
              onResize={() => setLeftCollapsed(leftPanelRef.current?.isCollapsed() ?? false)}
            >
              <AppSidebar onClose={toggleLeftSidebar} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="60" minSize="30">
              <div className="flex h-full flex-col">
                {projectName && (
                  <div className="shrink-0 border-b px-6 py-2">
                    <h2 className="truncate text-sm font-medium">{projectName}</h2>
                  </div>
                )}
                <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">{children}</main>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel
              panelRef={chatPanelRef}
              collapsible
              collapsedSize="0"
              minSize="16"
              maxSize="32"
              defaultSize="22"
              onResize={() => setChatCollapsed(chatPanelRef.current?.isCollapsed() ?? false)}
            >
              <ChatRightSidebar onClose={toggleChatSidebar} />
            </ResizablePanel>
          </ResizablePanelGroup>
          {leftCollapsed && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleLeftSidebar}
              aria-label="Open project sidebar"
              className="absolute top-3 left-3 z-10 shadow-sm"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          )}
          {chatCollapsed && (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={toggleChatSidebar}
              aria-label="Open chat sidebar"
              className="absolute top-3 right-3 z-10 shadow-sm"
            >
              <PanelRightOpen className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </ChatSidebarProvider>
  );
}
