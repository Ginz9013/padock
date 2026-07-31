// Project workspace shell (CONTEXT.md §5's UX shell): Task/Modules/Docs/
// Channels switching lives in the left AppSidebar's per-project sub-nav
// (Plane's sidebar-tree pattern) — real routes per section, not
// client-side tab state, so e.g. a doc still has its own bookmarkable
// URL. The project name itself lives in a persistent sub-header owned by
// the outer (app)/layout.tsx, not here — that keeps it visible while
// this content scrolls, instead of scrolling away with it.
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
