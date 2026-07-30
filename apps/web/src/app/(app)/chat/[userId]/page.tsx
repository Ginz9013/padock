"use client";

import { useParams } from "next/navigation";

import { useChatSidebar } from "@/components/chat/chat-sidebar-provider";
import { ChatThread } from "@/components/chat/chat-thread";
import { Avatar } from "@/components/ui/avatar";

export default function ChatDmPage() {
  const { userId } = useParams<{ userId: string }>();
  const { profiles, markRead } = useChatSidebar();
  const profile = profiles.get(userId);
  const name = profile?.name ?? userId;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ChatThread
        target={{ kind: "dm", withUserId: userId }}
        profiles={profiles}
        header={
          <div className="flex items-center gap-2.5 border-b px-4 py-3">
            <Avatar userId={userId} name={name} image={profile?.image} size={7} />
            <span className="text-sm font-semibold">{name}</span>
          </div>
        }
        onFocusInput={() => markRead(`dm:${userId}`)}
      />
    </div>
  );
}
