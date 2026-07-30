"use client";

import { useParams } from "next/navigation";

import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { ChatThread } from "@/components/chat/chat-thread";

export default function ChatChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { profiles, markRead } = useChatSidebar();

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-lg border">
      <ChatThread
        target={{ kind: "channel", channelId }}
        profiles={profiles}
        onFocusInput={() => markRead(`channel:${channelId}`)}
      />
    </div>
  );
}
