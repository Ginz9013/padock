"use client";

import { useSession } from "@/lib/auth-client";

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-heading text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        {session?.user ? `Welcome, ${session.user.name}.` : "Welcome."} Chat, tasks, and docs
        will live here.
      </p>
    </div>
  );
}
