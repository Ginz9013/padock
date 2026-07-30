// Landing state for the standalone chat surface (this session's UX
// decision — chat now has its own /chat/[userId] and
// /chat/channel/[channelId] routes instead of living inside
// Dashboard): shown when no conversation is selected yet.
export default function ChatIndexPage() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Pick someone from the People sidebar to start a conversation
    </div>
  );
}
