// Placeholder route so the sidebar's Channels link resolves to a page —
// the existing ChannelPanel is a persistent side panel, not a routable
// page; this is scaffolding for a future dedicated channels view.
export default function ProjectChannelsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">Channels</h2>
      <p className="text-sm text-muted-foreground">Coming soon.</p>
    </div>
  );
}
