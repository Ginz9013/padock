# Padock — Core Concept

> Status: v0.2 — core architecture and Phase 0–3 scope grilled and resolved (see §6/§7). Foundation for subsequent design & implementation. Update this file as decisions solidify; do not let it drift from reality.

## 1. One-liner

Padock is an open-source, self-hosted, **agent-first workspace** for SMEs that unifies team communication, task/project orchestration, and document management into one platform — plus a CLI + Skill layer that lets subscription-tier AI agents (Claude Code, Codex, Gemini CLI, etc.) operate the whole workspace on the user's behalf.

## 2. Problem statement

- AI is spreading fast inside SMEs, but most non-technical staff and even most technical staff use **subscription products** (Claude Pro/Max via Claude Code/Desktop, ChatGPT/Codex, Gemini) rather than pay-per-token API access.
- Subscription-tier agents are functionally locked into their official surfaces (chat UI, Claude Code, Codex CLI, Gemini CLI). There is no standard way for them to reach into a company's actual working systems — chat, tasks, documents — without someone building bespoke API integrations per tool, per company.
- Meanwhile SME operational data is fragmented across separate SaaS silos (chat app, task tracker, docs tool), each with its own auth, its own UI, and no shared "agent" concept. A person doing real work ("find X in project Y, analyze it, send it to a colleague, mark the task as review") has to manually hop between three tools; an agent today mostly can't do this at all unless someone pays for API access and wires up custom integrations per company.
- Padock's bet: if the workspace itself is **agent-native** (not "human app with an API bolted on") and ships a CLI + Skill that any subscription agent can pick up, SMEs get end-to-end agentic workflows without needing API-token billing or custom integration work.

## 3. Target users (TA)

Small-to-medium enterprises (中小企業) — teams too small to have a platform/integration engineering function, currently using disconnected SaaS tools, whose staff (technical and non-technical) primarily access AI through subscription products rather than API keys.

## 4. Core concept: agent-first workspace

"Agent-first" means the workspace's data model and APIs are designed so an **agent is a first-class actor**, not a UI convenience layered on top of a human-only app:

- Every meaningful operation (search, read, post message, change task status, create/edit doc) is exposed as a structured, scoped, auditable **action** — not just inferred from UI clicks.
- Actions are composable across domains: an agent should be able to chain "search across chat+tasks+docs → analyze → confirm with human → act → update state" in one flow, the way the motivating example describes:
  > "幫我去某某專案找某某資料，整理分析完之後告訴我，確認沒問題請幫我發給某某同事，然後把任務狀態改成 review。"
- Every agent action is attributable (which agent, on whose behalf, under what permission scope) and logged — SMEs need to trust what an autonomous agent did inside their real workspace.
- Irreversible/outward-facing actions (sending a message, closing a task) default to a **confirm-before-act** pattern, matching the example scenario's own "確認沒問題請...". **In v1 this is just the agent's own conversation turn, not server-side infrastructure**: v1 only supports interactive agents running in a live session with a human (e.g. a Claude Code conversation) — the human confirming in natural language *is* the confirm-before-act mechanism. Non-interactive/scheduled agents (no human present to confirm) are out of scope for v1 (§7, §10).

## 5. System architecture (proposed)

Three native subsystems, one shared platform, one integration layer that reaches out to external subscription agents.

```
┌─────────────────────────────────────────────────────────┐
│                     Padock Workspace                     │
│  ┌────────────┐   ┌────────────────┐   ┌──────────────┐  │
│  │   Chat     │   │  Task/Project   │   │   Document   │  │
│  │ (Zulip-    │   │  Orchestration  │   │  Management  │  │
│  │  inspired) │   │ (Plane-inspired)│   │(AFFiNE-      │  │
│  │            │   │                 │   │ inspired)    │  │
│  └────────────┘   └────────────────┘   └──────────────┘  │
│              shared: Postgres · Redis · Object storage    │
│              shared: auth, org/user model, action/audit    │
└───────────────────────┬─────────────────────────────────┘
                         │ internal API (REST/tRPC)
                ┌────────┴────────┐
                │   Padock CLI    │  ← single client/SDK,
                │ (padock ...)    │    one command grammar
                └────────┬────────┘    across all 3 domains
                         │
        ┌────────────────┼────────────────────┐
        │                │                    │
 ┌──────┴──────┐  ┌──────┴──────┐      ┌──────┴──────┐
 │ Claude Code │  │  Codex CLI  │      │ Gemini CLI  │
 │   Skill     │  │   adapter   │      │  extension  │
 └─────────────┘  └─────────────┘      └─────────────┘
   (subscription-tier agents — no API-token billing needed)
```

### 5.1 Padock Workspace (the product)

Self-built, not third-party integrations:

- **Chat** — team communication, channels/threads, DMs. Reference: Zulip (threaded conversation model).
- **Task/Project orchestration** — issues, projects, status workflows. Reference: Plane (open-source Jira-like model).
- **Document management** — knowledge base / docs, block-based content. Reference: AFFiNE (local-first, block model).
- Shared services: Postgres (system of record), Redis (cache/pubsub/queue, needed for chat realtime), object storage (S3-compatible, e.g. MinIO, for files/attachments).

**Architecture: modular monolith, multi-process deployment.** One TypeScript codebase; chat/tasks/docs are internal modules (folder boundaries + internal interfaces, no bypassing each other's data layers), sharing one Postgres schema. Deployed as multiple *process roles* from the same codebase — the same pattern Plane (Django: api/worker/beat) and Zulip (Django + Tornado realtime) use:

- `app` — Next.js web UI + tRPC API (the T3 core)
- `realtime` — standalone lightweight WebSocket gateway: manages long-lived connections, receives events via Redis pub/sub, pushes to clients. No business logic lives here.
- `worker` — background jobs (BullMQ or similar over Redis)

This is explicitly **not** domain microservices (no separate chat-service/task-service/doc-service): cross-domain search and transactions (§8) stay cheap, one version number for self-hosters, one repo for contributors. Redis pub/sub is the deliberate seam — if a domain or the realtime gateway ever needs to be extracted or horizontally scaled, the transport is already in place.

### 5.1.1 Tech stack: T3 + Turborepo

Core stack is the **T3 stack** (Next.js, tRPC, Tailwind, Auth.js, Prisma or Drizzle) inside a **create-t3-turbo-style Turborepo**:

```
apps/
  web/        # Next.js (T3): UI + tRPC API — the `app` process role
  realtime/   # ws gateway — the `realtime` process role
  worker/     # background jobs — the `worker` process role
  cli/        # padock CLI (see §5.2)
packages/
  api/        # tRPC routers (chat/tasks/docs modules live here)
  db/         # schema + ORM client
  auth/       # shared auth logic
  ...
```

Key property: the CLI imports the tRPC client and gets **end-to-end type safety** — an API signature change breaks the CLI at compile time, which matters for long-term OSS maintenance. tRPC is an internal contract, not a public third-party API; all first-party consumers (web, CLI, MCP wrapper, Skills) are TypeScript. If non-TS third-party clients are ever needed, generate a REST layer (e.g. trpc-openapi) then — not a v1 cost.

**How the CLI consumes tRPC** (tRPC is plain HTTP underneath; `@trpc/client` runs in any Node process):

- CLI uses `createTRPCClient<AppRouter>` + `httpBatchLink` pointed at the self-hosted instance's `/api/trpc`; `import type { AppRouter }` is type-only — no server code in the CLI bundle.
- **Dual-track auth**: browser sessions use Auth.js cookies; the CLI uses **Personal Access Tokens** (`padock login` → token stored in `~/.config/padock/`, sent as `Authorization: Bearer`). tRPC's `createContext` resolves identity from either source into the same context shape.
- **v1 login flow**: manual token copy — user generates a PAT from the web UI's settings page, pastes it into `padock login --token=<pat>`. No device-code flow in v1 (that's an OAuth Device Authorization Grant implementation cost not justified before there's a multi-user, non-technical audience actually hitting friction here).
- **v1 PAT scope: none — a PAT grants the full permissions of the user who created it.** No separate agent-scope system. This is deliberate, not an oversight: v1 only supports interactive agents (§4/§7) where a human is already in the loop approving risky actions before they happen, so a second permission layer on top would be solving a problem (unattended/non-interactive agents, multi-agent least-privilege) that doesn't exist yet. Revisit when non-interactive/scheduled agents are in scope (§7).
- **Version skew guard**: compile-time type safety doesn't protect a newer CLI against an older self-hosted server. CLI and server release together from the monorepo under one version; the CLI does a version handshake (`GET /api/version`) and warns on mismatch.

### 5.1.2 Cross-domain data model: the Project/Space entity

`§8`'s scenario filters across all three domains with `--project=某某專案`, which only works if chat/tasks/docs share a common anchor. Padock defines a single `Project` entity from day one (not deferred to a later phase — retrofitting it once chat/task/doc data already exists without a project reference would be a heavy migration):

- **Tasks** belong to exactly one `Project` (required foreign key).
- **Docs** belong to exactly one `Project` (required foreign key) — v1 has no folder hierarchy beyond this.
- **Chat** is DM-only in v1 (see §5.1.3) and is *not* organized into project channels yet, but each message can **optionally** carry a `project_id` tag — set by a human or agent when a DM is "about" a project. `--project=X` search spans docs + tasks (always project-scoped) + any chat messages tagged with that project (opt-in).

### 5.1.3 Module scope for Phase 1 (confirmed)

- **Chat**: point-to-point DM only. No channels, no threads, no unread state — just send/read a message between two accounts. Enough to validate step 4 of §8 ("發給某某同事"). Messages can optionally carry `project_id` (§5.1.2).
- **Task**: fixed status enum (`todo` / `in_progress` / `review` / `done`), no custom workflows. Every task belongs to one Project. Custom workflow states are a Phase 4+ concern (Plane-style configurability), not v1.
- **Doc**: stored as plain Markdown text, not block-based JSON. `padock doc get <id>` returns Markdown directly — the most LLM/agent-readable format, and the cheapest to build. The long-term AFFiNE-style block model is a storage-layer migration (Markdown → blocks) for later; it does not change the CLI/Skill contract, since agents will keep consuming readable text either way.
- **Search**: Postgres full-text search (`tsvector`), not semantic/vector search. No embedding model or extra API dependency — consistent with the "no API token required" premise. Padock returns precise keyword/metadata matches; semantic interpretation of results is left to the calling agent's own LLM reasoning, not to Padock's search layer. Revisit only if keyword search proves insufficient in practice.

### 5.2 Padock CLI

The actual engine that agents drive. One consistent command grammar across all three domains, e.g.:

```
padock search "<query>" --scope=docs,tasks,chat --project=<name>
padock doc get <id>
padock task update <id> --status=review
padock chat send --to=<user|channel> --message="..."
padock whoami / padock login   # auth against a running Padock instance
```

The CLI is the single implementation of "how to talk to Padock." Everything above it (MCP server, Skill packages) is a thin adapter, not a reimplementation.

### 5.3 Skill / adapter layer

Per-agent-runtime packages that teach a subscription agent when and how to invoke the CLI:

- **Claude Code**: a Skill (`SKILL.md` + optional scripts) that documents the command grammar and trigger phrases; can shell out to the CLI directly (works today via the Bash tool) and/or wrap an MCP server (`padock mcp serve`) for richer structured tool calls.
- **Codex CLI / Gemini CLI**: equivalent thin adapters (tool/plugin manifest + instructions), same underlying CLI.
- Recommended build order: Claude Code Skill first (dogfeed-able immediately, richest skill/MCP ecosystem today), then generalize.
- **Distribution (v1)**: the Skill ships as part of the `padock` CLI package, not through a separate marketplace/registry. Running `padock init-skill` writes a local `SKILL.md` (matched to the installed CLI's version) into `~/.claude/skills/`. This keeps the Skill in lockstep with the CLI's command grammar automatically and avoids a second release/review pipeline before the project has any external users. Publishing to an official skill/plugin marketplace is a later distribution optimization, not a v1 requirement.

## 6. Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | Self-hosted only for v1, via docker-compose | SME data stays in-house; matches OSS positioning; cloud/SaaS is a possible future add-on, not a v1 goal |
| Third-party integrations | None — Padock builds its own chat/task/doc services | Core differentiator; avoids being at the mercy of Slack/Notion/etc. API limits and pricing |
| Data storage | Postgres + Redis + object storage, all self-hosted | Native services need a real system of record; no "aggregate vs. passthrough" tradeoff since there's no external source of truth to sync from |
| Core tech stack | TypeScript / Node.js full-stack — **T3 stack (Next.js/tRPC/Tailwind/Auth.js) in a Turborepo** (§5.1.1) | One language across backend, web app, CLI, and Skill/MCP tooling; tRPC gives compile-time type safety all the way into the CLI; maintainer's strongest stack; large OSS contributor pool |
| Backend architecture | Modular monolith, multi-process deployment (`app`/`realtime`/`worker` roles from one codebase) — **not** domain microservices | Cheap cross-domain queries/transactions (§8), one version for self-hosters, one-repo contributor onboarding; uneven load across modules is handled by scaling process roles, not by splitting domains; Redis pub/sub is the extraction seam if ever needed. Same pattern as Plane/Zulip. |
| Tenancy | Single-tenant: one Padock instance = one organization; roles/permissions within the org | Drastically simpler auth model; matches self-host positioning |
| Agent transport | CLI-first; MCP server (`padock mcp serve`) is a thin wrapper over the same client | Any agent with a Bash/exec tool can use the CLI even where MCP support is weak; one implementation of "how to talk to Padock" |
| v1 realtime scope | Realtime chat: yes (ws gateway + Redis pub/sub). Docs: single-user editing + version history; CRDT multi-user co-editing deferred | Chat is unusable without push; AFFiNE-style CRDT co-editing is a large subsystem — long-term goal is to converge toward AFFiNE, and the transport (ws + Redis) is built so only the doc module's merge/storage logic changes when CRDT (e.g. Yjs) lands |
| Reference projects | Zulip (chat), Plane (tasks), AFFiNE (docs) | Named directly by the user as design references, not for integration |
| First validation target | Dogfooding — maintainer's own project/work, not an external pilot company | Shortest feedback loop; also the most convincing OSS demo. Multi-user collaboration depth is under-validated as a tradeoff, addressed by the two-account minimum below |
| Cross-domain data model | Unified `Project` entity built from day one (§5.1.2); tasks and docs require it, chat tags it optionally | `--project=X` search across domains needs a shared anchor; retrofitting this after data exists without it is a heavy migration |
| Search mechanism | Postgres full-text (`tsvector`); no embeddings/vector search in v1 | Keeps the "no API token needed" premise honest — semantic search would require an embedding model dependency; agents already have their own LLM reasoning to interpret keyword results |
| Agent execution mode (v1) | Interactive only — agent runs in a live session with a human present | Confirm-before-act (§4) is just the conversation itself; no server-side approval queue needed yet. Non-interactive/scheduled agents deferred (§10) |
| PAT scope | No granular scopes in v1 — a PAT = full permissions of the user who created it | A second permission layer has no problem to solve yet while every action is human-approved in real time; add granularity when non-interactive agents or stricter least-privilege needs arrive |
| CLI login flow | Manual token copy: generate PAT in web UI settings → `padock login --token=...` | Device-code (OAuth Device Authorization Grant) flow is nicer UX but unjustified implementation cost before v1 has real friction from it |
| Doc storage format | Plain Markdown text, not block-based JSON | Cheapest to build, most LLM/agent-readable; AFFiNE-style block model is a future storage migration, not a CLI/Skill contract change |
| Task model (Phase 1) | Fixed status enum (`todo`/`in_progress`/`review`/`done`), one Project per task, no custom workflows | Matches §8's exact need ("改成 review"); configurable workflows (Plane-style) are a Phase 4+ concern |
| Chat scope (Phase 1) | Point-to-point DM only, no channels/threads/unread state; messages optionally tag a `project_id` | Matches §8's exact need ("發給某某同事"); full Zulip-style channel model deferred to Phase 4 |
| Skill distribution (v1) | `padock init-skill` generates a local `SKILL.md` from the installed CLI, no marketplace | Keeps Skill and CLI versions in lockstep automatically; avoids a second release pipeline pre-launch |

## 7. Open decisions (deferred, not blocking Phase 0–3)

- **Granular agent permission model** (per-project/per-domain/read-write-send scopes): explicitly deferred, not just unresolved — v1's PAT-has-full-access + interactive-only-agents combo (§6) makes it unnecessary for now. Revisit when either non-interactive/scheduled agents or multi-agent least-privilege needs enter scope.
- **Non-interactive/scheduled agent support**: v1 assumes a human is always present in the agent's session (§6). Supporting unattended agents later requires designing a server-side approval queue/notification mechanism for confirm-before-act (§4) — a real, currently-unscoped piece of work, not a detail.
- **ORM choice**: Prisma vs. Drizzle — both fit the T3 setup; pick by maintainer familiarity when scaffolding Phase 0. Minor.

## 8. Example end-to-end flow (north star scenario)

> "幫我去某某專案找某某資料，整理分析完之後告訴我，確認沒問題請幫我發給某某同事，然後把任務狀態改成 review。"

1. Agent (via Skill, running interactively with the user present) calls `padock search "某某資料" --project=某某專案` → full-text search hits docs + tasks (always project-scoped) + any chat DMs previously tagged with that `project_id` (§5.1.2), in one query.
2. Agent reads/analyzes returned content itself (Padock returns raw matches, not a semantic summary — §5.1.3) and reports findings back to the user in the same conversation.
3. User confirms ("沒問題") — this *is* the confirm-before-act step (§4); no separate approval mechanism exists in v1.
4. Agent calls `padock chat send --to=同事 --message="<analysis summary>"` (point-to-point DM — §5.1.3).
5. Agent calls `padock task update <id> --status=review` (one of the four fixed statuses — §5.1.3).
6. Every step above is attributed to the agent + user (via the PAT used) in Padock's audit log.

This flow is the acceptance test for the MVP: if it can't run end-to-end (even with minimal features in each domain), the MVP isn't done.

## 9. Proposed phasing (tracer-bullet, not deep-then-deep)

Build a thin walking skeleton across all three domains first, validate the flow in §8 end-to-end, then deepen each domain — rather than fully building one domain before starting the next.

1. **Phase 0 — Platform skeleton**: Turborepo scaffold, auth (Auth.js + PAT dual-track), `Project` entity + org/user model, Postgres+Redis+storage wiring, docker-compose (`app`/`realtime`/`worker` roles).
2. **Phase 1 — Thin vertical slice**: DM-only chat, fixed-enum task status, Markdown docs — all Project-scoped per §5.1.2–5.1.3 — enough for §8 to run manually via the web UI / direct API calls.
3. **Phase 2 — Padock CLI**: implement the command grammar in §5.2 (incl. `padock login` manual-token flow, `tsvector` search) against the Phase 1 API.
4. **Phase 3 — Claude Code Skill**: `padock init-skill` + dogfeed the §8 scenario end-to-end with a real subscription agent, on the maintainer's own project (§6 first validation target).
5. **Phase 4 — Deepen each domain**: channels/threads for chat, configurable workflows for tasks, block-based editing for docs (Markdown → blocks migration).
6. **Phase 5 — Generalize the adapter layer**: Codex CLI / Gemini CLI adapters, MCP server wrapper, skill-marketplace distribution.
7. **Phase 6 — Non-interactive agents & fine-grained permissions**: server-side approval queue for confirm-before-act, granular PAT scopes — only once unattended/scheduled agents are actually in scope (§7).

## 10. Non-goals (v1)

- No third-party SaaS integrations (Slack/Notion/Jira/etc.) — explicitly out of scope; Padock is the tool, not a connector hub.
- No multi-tenant SaaS hosting.
- No full realtime multi-cursor collaborative document editing in v1 (decided in §6: single-user editing + version history first; CRDT later, transport designed to accommodate it).
- No semantic/vector search in v1 (§5.1.3, §6) — full-text only, to avoid an embedding-model dependency.
- No non-interactive/scheduled agent support in v1 (§6, §7) — every agent action happens in a live session with a human present; unattended agents are a Phase 6 concern.
- No granular agent permission scopes in v1 (§6, §7) — a PAT is all-or-nothing, matching the interactive-only execution model.
- No configurable task workflows in v1 (§5.1.3) — fixed four-state enum only.
- No chat channels/threads in v1 (§5.1.3) — DM only.

## 11. Naming reference note

"Padock" — treat as the project's proper name throughout; this doc uses it consistently to anchor future docs/ADRs.
