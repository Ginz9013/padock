"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRightOpen } from "lucide-react";
import type { PanelImperativeHandle } from "react-resizable-panels";

import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatSidebarProvider } from "@/components/chat/chat-sidebar-provider";
import { ChatRightSidebar } from "@/components/chat/chat-right-sidebar";

// Sidebar-first shell, not a top-nav bar (this session's UX decision,
// CONTEXT.md §5's UX shell): the app is organized by "where you are"
// (Dashboard / a Project) rather than by domain module, so the
// project list belongs in the persistent nav, not a dropdown.
//
// Three-column row (left AppSidebar / main content / right chat
// sidebar) sits *below* a full-width header, not beside it — the
// header spans the whole viewport width; only the row underneath is
// split into columns. The right chat sidebar is resizable-by-drag and
// collapsible via a toggle button in its own top bar (not the app
// header), using react-resizable-panels (shadcn's `resizable`) rather
// than shadcn's `Sidebar` primitive: Sidebar only toggles between
// fixed preset widths, it has no drag-to-resize, which this needed
// alongside the collapse button. Collapsing shrinks the panel to zero
// width, so there's nothing left in the row to click to reopen it —
// a floating button anchored to the row's top-right corner covers
// that case.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const chatPanelRef = useRef<PanelImperativeHandle>(null);
  const [chatCollapsed, setChatCollapsed] = useState(false);

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

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
        <header className="flex w-full shrink-0 items-center justify-end gap-3 border-b px-6 py-3">
          {session?.user && (
            <span className="text-sm text-muted-foreground">{session.user.email}</span>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </header>
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar />
          <ResizablePanelGroup orientation="horizontal" className="min-w-0 flex-1">
            <ResizablePanel defaultSize="78" minSize="40">
              <main className="h-full overflow-y-auto px-6 py-8">{children}</main>
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
