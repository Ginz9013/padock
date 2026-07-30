"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-semibold">Padock</h1>
        <p className="max-w-md text-muted-foreground">
          Agent-first workspace for SMEs — chat, tasks, and docs in one place, built for
          both people and the AI agents working alongside them.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/register">Sign up</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </div>
  );
}
