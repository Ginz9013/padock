"use client";

import { useParams } from "next/navigation";
import { Hash } from "lucide-react";

import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { ChatThread } from "@/components/chat/chat-thread";

export default function ChatChannelPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { conversations, profiles, markRead } = useChatSidebar();
  const title = conversations.find((c) => c.key === `channel:${channelId}`)?.label ?? channelId;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChatThread
        target={{ kind: "channel", channelId }}
        profiles={profiles}
        header={
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Hash className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
        }
        onFocusInput={() => markRead(`channel:${channelId}`)}
      />
    </div>
  );
}
