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
                ┌────────┴────────┐
                │  one SKILL.md   │  ← open Agent Skills standard (§5.3)
                │ (padock init-   │    padock init-skill distributes it
                │  skill writes   │    unmodified to every discovery path
                │  it 3 places)   │
                └────────┬────────┘
                         │
        ┌────────────────┼────────────────────┐
        │                │                    │
 ┌──────┴──────┐  ┌──────┴──────┐      ┌──────┴──────┐
 │ Claude Code │  │  Codex CLI  │      │ Gemini CLI  │
 └─────────────┘  └─────────────┘      └─────────────┘
   (subscription-tier agents — no API-token billing needed)
```

For agents with MCP support, `padock mcp serve` (§5.3, Phase 5) is an alternate path alongside the Skill — same CLI, same auth, just structured tool calls instead of shell-parsed stdout.

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

Core stack is the **T3 stack** (Next.js, tRPC, Tailwind, Better Auth, Prisma) inside a **create-t3-turbo-style Turborepo**:

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
- **Auth: Better Auth**, not Auth.js (NextAuth) — Auth.js entered maintenance-only mode in early 2026 when Better Auth absorbed the project (security patches only, no new features); Better Auth itself was acquired by Vercel in July 2026 and is under active development, including an "Agent Auth" protocol for AI agent identity — directly adjacent to this project's own agent-attribution needs (§4). Better Auth is also framework-agnostic, which matters because `realtime`/`worker` are plain Node processes, not Next.js apps, and need to validate the same identity without a Next.js request context. A shared `packages/auth` instance (Prisma adapter) is mounted by `apps/web` and imported directly by `apps/realtime`/`apps/worker`.
- **Dual-track auth**: browser sessions use Better Auth's session cookies; the CLI uses Better Auth's official **API Key plugin** as its Personal Access Token (PAT) mechanism (`padock login` → key stored in `~/.config/padock/`, sent as an `x-api-key` header — the plugin's default). Verified against the real package: Better Auth *can* auto-mock a session from an API key (`enableSessionForAPIKeys`), but that flag is off by default and explicitly documented as not production-safe — so our tRPC context resolves identity explicitly instead: try `auth.api.getSession()` (cookie) first, then fall back to `auth.api.verifyApiKey()` against the `x-api-key` header, both collapsing into one context shape. This replaces a hand-rolled PAT table/middleware, and the API Key plugin supports per-key scoping if/when granular agent permissions (§7) are needed later.
- **Organization plugin** (official) gives roles/membership within the single-tenant org (§6) without hand-rolling a membership table.
- **v1 login flow**: manual token copy — user generates an API key from the web UI's settings page, pastes it into `padock login --token=<key>`. No device-code flow in v1 (that's an OAuth Device Authorization Grant implementation cost not justified before there's a multi-user, non-technical audience actually hitting friction here).
- **PAT granular scopes — done (Phase 6)**: per-domain `read`/`write` scopes (`project`, `task`, `taskState`, `doc`, `chat`, `channel`, `topic`, `user`, `search`), mapped 1:1 onto tRPC's query/mutation split via a `scopedProcedure(resource, action)` builder in `packages/api/src/trpc.ts`. Stored in the API Key plugin's existing `permissions` column (`Record<string, string[]>`, verified against the real `@better-auth/api-key` package — no schema migration needed). `permissions: null` (every key issued before this phase, and any new key created without `--scope`) stays **unrestricted**, so nothing existing breaks. Key issuance (`apikey.create`) is gated behind a **session-only** procedure — no API key, scoped or not, can mint another key, closing the self-escalation path outright. Finer granularity (per-project, per-verb) is deferred — not needed yet. One real constraint surfaced during verification: the CLI's name-based resolution (`resolve.ts`'s `resolveProjectId`/etc.) always calls the target domain's own `list` procedure first, so a scoped key needs `project:read` (and similarly `channel:read` for topic resolution) as a practical baseline alongside whatever domain it's actually meant to touch.
- **Enterprise directory login (LDAP)**: no raw LDAP bind in v1. Better Auth has no official LDAP plugin (a feature request for one was explicitly closed "not planned" by the maintainers; only an unofficial community plugin exists). The supported enterprise-auth path is Better Auth's official **SSO plugin** (SAML/OIDC) — the realistic modern pattern is fronting AD/LDAP with an identity provider (Entra ID, Okta, or self-hosted Keycloak, which itself can bridge to LDAP) rather than Padock speaking raw directory protocol. Revisit direct LDAP bind only if a real deployment needs it and the SSO path proves insufficient.
- **Version skew guard**: compile-time type safety doesn't protect a newer CLI against an older self-hosted server. CLI and server release together from the monorepo under one version; the CLI does a version handshake (`GET /api/version`) and warns on mismatch.
- **Origin header requirement (verified in Phase 0)**: Better Auth rejects state-changing requests (sign-up, sign-in, API key creation, etc.) with `MISSING_OR_NULL_ORIGIN` unless an `Origin` header matching a trusted origin is present — true even for non-browser clients. The Phase 2 CLI must send `Origin: <server base URL>` on every request that hits these endpoints.

### 5.1.2 Cross-domain data model: the Project/Space entity

`§8`'s scenario filters across all three domains with `--project=某某專案`, which only works if chat/tasks/docs share a common anchor. Padock defines a single `Project` entity from day one (not deferred to a later phase — retrofitting it once chat/task/doc data already exists without a project reference would be a heavy migration):

- **Tasks** belong to exactly one `Project` (required foreign key).
- **Docs** belong to exactly one `Project` (required foreign key) — v1 has no folder hierarchy beyond this.
- **Chat** shipped DM-only in Phase 1 (see §5.1.3); Phase 4 added Zulip-style channels + topics. A DM can optionally carry a `project_id` tag — set by a human or agent when a DM is "about" a project. A **channel** can itself optionally belong to a Project (its messages inherit that project context; they don't carry their own tag). `--project=X` search spans docs + tasks (always project-scoped) + any project-tagged DMs + any messages in a project-scoped channel (opt-in either way).

### 5.1.3 Module scope for Phase 1 (confirmed)

- **Chat**: point-to-point DM only. No channels, no threads, no unread state — just send/read a message between two accounts. Enough to validate step 4 of §8 ("發給某某同事"). Messages can optionally carry `project_id` (§5.1.2).
- **Task** shipped Phase 1 with a fixed status enum (`todo`/`in_progress`/`review`/`done`), no custom workflows. Phase 4 replaced this with per-project configurable states — see §5.1.5.
- **Doc**: stored as plain Markdown text, not block-based JSON. `padock doc get <id>` returns Markdown directly — the most LLM/agent-readable format, and the cheapest to build. The long-term AFFiNE-style block model is a storage-layer migration (Markdown → blocks) for later; it does not change the CLI/Skill contract, since agents will keep consuming readable text either way.
- **Search**: Postgres full-text search (`tsvector`), not semantic/vector search. No embedding model or extra API dependency — consistent with the "no API token required" premise. Padock returns precise keyword/metadata matches; semantic interpretation of results is left to the calling agent's own LLM reasoning, not to Padock's search layer. Revisit only if keyword search proves insufficient in practice.

### 5.1.4 Chat channels/threads (Phase 4, confirmed)

Zulip's stream+topic model (§5.1's reference), not Slack's channel+reply-thread model: a `Channel` contains named `Topic`s, and every message belongs to exactly one topic. A `ChatMessage` is now either a DM (`recipientId` set) or a channel message (`channelId`+`topicId` set) — never both.

- **Channels can be org-wide or project-scoped** (`Channel.projectId` optional) — not one or the other. Same opt-in-tag pattern as a DM's `project_id` (§5.1.2), just one level up: a channel's project context applies to all its messages instead of being set per-message.
- **No per-channel membership/subscription model in v1** — consistent with §6/§7's "no granular permissions yet" stance. Every org member can read every channel/topic; there's nothing to join or be excluded from. Real per-channel access control is deferred to the same future bucket as granular agent permissions (§7), not invented piecemeal here. DMs remain private to their two participants (enforced at the query layer, unchanged from Phase 1).
- **Realtime broadcast is unfiltered** — `apps/realtime`'s WebSocket gateway (built Phase 0, unused until now) broadcasts every chat event (DM or channel) to every connected authenticated socket, no per-channel/per-DM filtering. A client's actual read scope is enforced by `chat.history`/`conversation`/`search`, not the push layer — the push is a "something changed, go re-fetch" signal, not a delivery-scoped feed. This is the first real use of the Redis pub/sub seam §5.1 named as the future extraction/scaling point.

### 5.1.5 Task workflows (Phase 4, confirmed)

Plane's actual model (the named reference), replacing Phase 1's fixed `TaskStatus` enum: each `Project` defines its own set of `TaskState`s instead of every task sharing one global enum. A state has a `name`, a semantic `group` (`backlog`/`unstarted`/`started`/`completed`/`cancelled` — Plane's own five categories, so reporting/search can reason across projects even when state *names* differ), a `position` (ordering within that project's workflow), and `isDefault` (which state a new task lands in).

- **Configurable state sets, not configurable transition rules.** Plane itself doesn't hard-enforce which state can move to which — the configurable part is *what states exist* in a project, not a transition-validation engine. Building transition rules here would be scope creep beyond what "Plane-style configurability" actually names.
- **Every project is seeded with six default states on creation** (Backlog/Todo/In Progress/In Review/Done/Cancelled, "Todo" as default) so it's immediately usable — not stuck with zero valid states until someone manually configures a workflow. Projects can add their own states beyond these (`task-state create`).
- **`padock task update <id> --status=<name>` resolves the name against that task's own project's states**, not a global enum — the CLI looks the task up first (`task.get`, new in Phase 4) to find its project, then resolves. Two different projects can have identically-named states (e.g. both defining "Blocked") without conflict — `TaskState` is unique per `(projectId, name)`, not globally.

**Migration note (real, not hypothetical — Phase 4 shipped with live dogfood data in play):** Phase 1's two existing tasks had non-null `status` values. Dropping that column required an explicit two-step schema change (add `TaskState`/optional `stateId` first, backfill, then drop `status`/`TaskStatus`), not a single blind schema push. This is what prompted the tooling change below.

### 5.1.6 Schema tooling: `prisma migrate`, not `db push` (Phase 4, confirmed)

Attempting the `status`-column drop above via `prisma db push --accept-data-loss` triggered Prisma's own built-in AI-agent safety gate: it detected an agent invoking a destructive flag and refused to run without the user's explicit, verbatim consent (a real, current guardrail in the Prisma CLI, not a Padock feature). The user's direction after that: stop using `db push` for schema changes going forward, adopt `prisma migrate` properly.

- The existing `db push`-managed database was **baselined**, not reset: `prisma migrate diff --from-empty --to-config-datasource --script` captured the live database's actual current state as `migrations/0_init`, then `prisma migrate resolve --applied 0_init` recorded it as already-applied without executing anything — zero data touched by this step.
- New schema changes now go through a real migration file, generated via `prisma migrate diff` (comparing the live database against the target `schema.prisma`) and reviewed as a diffable `.sql` file before being applied with `prisma migrate deploy` — not blind `db push --accept-data-loss`. The Docker `app` image's boot command changed to match (`prisma migrate deploy`, not `db push`).
- This is a real workflow change, not a one-off: every future schema change goes through this same generate-review-apply sequence.

### 5.1.7 Doc block-based storage (Phase 4, confirmed)

Replaces Phase 1's plain-Markdown-text storage, per the migration §5.1.3 always named as coming. **mdast (Markdown AST, from the `remark`/`unified` ecosystem) is the block tree — not a bespoke block schema.** mdast already models a document as a tree of typed blocks (`heading`, `paragraph`, `list`/`listItem`, `code`, `blockquote`, ...); that's what "block-based storage instead of a raw text blob" means, so there was nothing to invent. `Doc.blocks` stores the parsed tree (`Json`); `Doc.searchText` is a plain-text extraction of it (`mdast-util-to-string`), kept only so full-text search stays a normal Postgres `text` column instead of reaching into JSON at query time.

- **The CLI/Skill contract is unchanged, verified rather than assumed** — `packages/api/src/router/doc.ts` parses incoming Markdown to `blocks` on write and stringifies `blocks` back to Markdown as `content` on every read (`get`/`list`/`create`/`update` all return `content`, never `blocks`/`searchText`). Confirmed zero files touched under `apps/cli/` or `apps/cli/skill/` for this phase.
- **Round-tripping is structurally, not byte-for-byte, identical.** `remark-stringify` normalizes on the way back out — e.g. `-` bullets become `*`, a trailing newline gets added. Content and meaning are unchanged; exact source bytes are not preserved. This is a real, observed deviation from what the original Phase 1 wording ("agents will keep consuming readable text either way") implied, not a defect — no agent or human reading either version would notice a semantic difference, but it's worth being precise that it isn't a lossless byte-identity guarantee.
- **No custom block types, no CRDT.** Both stay exactly as scoped: a future editor UI needing block types beyond what Markdown expresses would be an additive schema extension on top of mdast, not a reason to have built a bespoke schema now; CRDT/multi-user co-editing remains deferred per §6.

### 5.2 Padock CLI

The actual engine that agents drive. One consistent command grammar across all three domains, e.g.:

```
padock search "<query>" --scope=docs,tasks,chat --project=<name>
padock doc get <id>
padock task update <id> --status=review
padock chat send --to=<user|channel> --message="..."
padock whoami / padock login   # auth against a running Padock instance
```

The CLI is the single implementation of "how to talk to Padock." Everything above it (MCP server, the Skill's instructions — §5.3) is a thin adapter, not a reimplementation.

### 5.3 Skill layer — one portable SKILL.md, not per-agent adapters

**Agent Skills (the `SKILL.md` format) is a cross-vendor open standard, not a Claude-only mechanism** — published at agentskills.io in December 2025, adopted within 48 hours by OpenAI and Microsoft, and natively supported by Claude Code, Codex CLI, Gemini CLI, Cursor, GitHub Copilot, and 35+ other tools as of mid-2026. As long as a `SKILL.md` sticks to the *core* spec — `name`/`description` frontmatter + a Markdown instruction body, no tool-specific frontmatter extensions — the same file works unmodified across all of them. This changes the design from "build Claude's adapter first, generalize later" to: **write one Skill, distribute it to every discovery path.**

- **Content**: one `SKILL.md` documenting the CLI's command grammar (§5.2) and trigger phrases — teaches any agent when and how to shell out to `padock`. No agent-specific variants; if a tool-specific extension is ever needed for one platform, it's additive (tools ignore fields they don't recognize) and doesn't fork the file.
- **Discovery paths differ per tool, even though the file doesn't** — `padock init-skill` writes the identical `SKILL.md` to each known location:
  - `.agents/skills/padock/` (repo-level) — scanned directly by **Codex CLI** and aliased by **Gemini CLI** (`.gemini/skills/` treats `.agents/skills/` as an alias)
  - `~/.agents/skills/padock/` (user-level) — same alias relationship, covers both tools' user-tier scan
  - `~/.claude/skills/padock/` — **Claude Code**'s own convention; not confirmed to alias `.agents/skills/`, so it gets its own copy
  - Three file writes of one identical source, not three different packages.
- **Distribution (v1)**: ships as part of the `padock` CLI package, not a separate marketplace/registry. `padock init-skill` writes the version-matched `SKILL.md` to the paths above. Keeps the Skill in lockstep with the CLI's command grammar automatically; avoids a second release/review pipeline before the project has external users. Publishing to agentskills.io or an official marketplace is a later distribution optimization, not a v1 requirement.
- **MCP server wrapper — done (Phase 5)**: `padock mcp serve` starts an MCP server (stdio transport, verified against the real `@modelcontextprotocol/sdk` v1.30.0) exposing the full command grammar as ~20 tools, one per CLI subcommand (`project_create`, `task_update`, `chat_send`, `search`, ...) plus `whoami`. Not a second implementation — every tool calls the same `actions/*.ts` functions the CLI commands themselves call (extracted specifically so there'd be exactly one implementation, not a CLI copy and an MCP copy); reuses the same `~/.config/padock/` login, no separate auth. `login`/`init-skill` are deliberately **not** tools — they're one-time human setup steps, not part of the day-to-day grammar an agent drives. Not required for cross-agent reach (the Skill format already solved that, above) — this is purely an optional richer transport for MCP-capable clients that would otherwise have to shell-parse the CLI's stdout.
- **Still open**: publishing the Skill to agentskills.io or an official marketplace — a real external/public action requiring a human decision on timing, not engineering work, so it stays unscheduled rather than being treated as "not started yet."

## 6. Confirmed decisions

| Decision | Choice | Why |
|---|---|---|
| Hosting | Self-hosted only for v1, via docker-compose | SME data stays in-house; matches OSS positioning; cloud/SaaS is a possible future add-on, not a v1 goal |
| Third-party integrations | None — Padock builds its own chat/task/doc services | Core differentiator; avoids being at the mercy of Slack/Notion/etc. API limits and pricing |
| Data storage | Postgres + Redis + object storage, all self-hosted | Native services need a real system of record; no "aggregate vs. passthrough" tradeoff since there's no external source of truth to sync from |
| Core tech stack | TypeScript / Node.js full-stack — **T3 stack (Next.js/tRPC/Tailwind/Prisma) in a Turborepo** (§5.1.1) | One language across backend, web app, CLI, and Skill/MCP tooling; tRPC gives compile-time type safety all the way into the CLI; maintainer's strongest stack; large OSS contributor pool |
| ORM | Prisma | Maintainer's explicit choice; mature ecosystem, Prisma Studio, official Better Auth adapter |
| Auth | **Better Auth** (not Auth.js) — API Key plugin as the CLI's PAT mechanism, Organization plugin for org roles, SSO plugin (SAML/OIDC) as the enterprise-directory path | Auth.js is maintenance-only since Better Auth absorbed it in early 2026; Better Auth is framework-agnostic (needed for `realtime`/`worker`, which aren't Next.js apps) and actively developed (acquired by Vercel, July 2026). See §5.1.1 for detail |
| Backend architecture | Modular monolith, multi-process deployment (`app`/`realtime`/`worker` roles from one codebase) — **not** domain microservices | Cheap cross-domain queries/transactions (§8), one version for self-hosters, one-repo contributor onboarding; uneven load across modules is handled by scaling process roles, not by splitting domains; Redis pub/sub is the extraction seam if ever needed. Same pattern as Plane/Zulip. |
| Tenancy | Single-tenant: one Padock instance = one organization; roles/permissions within the org | Drastically simpler auth model; matches self-host positioning |
| Agent transport | CLI-first; MCP server (`padock mcp serve`) is a thin wrapper over the same client | Any agent with a Bash/exec tool can use the CLI even where MCP support is weak; one implementation of "how to talk to Padock" |
| v1 realtime scope | Realtime chat: yes (ws gateway + Redis pub/sub). Docs: single-user editing + version history; CRDT multi-user co-editing deferred | Chat is unusable without push; AFFiNE-style CRDT co-editing is a large subsystem — long-term goal is to converge toward AFFiNE, and the transport (ws + Redis) is built so only the doc module's merge/storage logic changes when CRDT (e.g. Yjs) lands |
| Reference projects | Zulip (chat), Plane (tasks), AFFiNE (docs) | Named directly by the user as design references, not for integration |
| First validation target | Dogfooding — maintainer's own project/work, not an external pilot company | Shortest feedback loop; also the most convincing OSS demo. Multi-user collaboration depth is under-validated as a tradeoff, addressed by the two-account minimum below |
| Cross-domain data model | Unified `Project` entity built from day one (§5.1.2); tasks and docs require it, chat tags it optionally | `--project=X` search across domains needs a shared anchor; retrofitting this after data exists without it is a heavy migration |
| Search mechanism | Postgres full-text (`tsvector`); no embeddings/vector search in v1 | Keeps the "no API token needed" premise honest — semantic search would require an embedding model dependency; agents already have their own LLM reasoning to interpret keyword results |
| Agent execution mode (v1) | Interactive only — agent runs in a live session with a human present | Confirm-before-act (§4) is just the conversation itself; no server-side approval queue needed yet. Non-interactive/scheduled agents deferred (§10) |
| PAT scope (Phase 6) | Per-domain `read`/`write` scopes on the API Key plugin's `permissions` field; `null` (default) stays unrestricted; key creation is session-only, never delegable from another key | §5.1.1. Real value now (hand an agent a read-only key) without waiting on non-interactive-agent support; finer (per-project) granularity deferred |
| CLI login flow | Manual token copy: generate PAT in web UI settings → `padock login --token=...` | Device-code (OAuth Device Authorization Grant) flow is nicer UX but unjustified implementation cost before v1 has real friction from it |
| Doc storage format (Phase 1) | Plain Markdown text, not block-based JSON | Cheapest to build, most LLM/agent-readable; AFFiNE-style block model is a future storage migration, not a CLI/Skill contract change |
| Doc block storage (Phase 4) | mdast (Markdown AST) *is* the block tree, no bespoke schema; `blocks`+`searchText`, CLI/Skill still only ever see Markdown `content` | §5.1.7. Round-tripping is structural, not byte-for-byte (remark-stringify normalizes bullets/trailing newline) |
| Task model (Phase 1) | Fixed status enum (`todo`/`in_progress`/`review`/`done`), one Project per task, no custom workflows | Matches §8's exact need ("改成 review"); configurable workflows (Plane-style) are a Phase 4+ concern |
| Chat scope (Phase 1) | Point-to-point DM only, no channels/threads/unread state; messages optionally tag a `project_id` | Matches §8's exact need ("發給某某同事"); full Zulip-style channel model deferred to Phase 4 |
| Chat channels (Phase 4) | Zulip stream+topic model; `Channel.projectId` optional (org-wide or project-scoped, not one or the other); no per-channel membership model; realtime broadcast unfiltered | §5.1.4. Per-channel membership/access-control still deferred (distinct from Phase 6's PAT scoping, which is per-domain not per-resource-instance); realtime push finally uses Phase 0's ws+Redis plumbing for something real |
| Task workflows (Phase 4) | Per-project `TaskState` (Plane's model) replaces the fixed enum; configurable state *sets*, not transition rules; six defaults seeded per project | §5.1.5. Matches "Plane-style configurability" without building a transition-rule engine nobody asked for |
| Schema tooling (Phase 4) | `prisma migrate` (baseline + generate + review + `migrate deploy`), not `db push` | §5.1.6. Triggered by Prisma's own AI-agent safety gate refusing a blind `db push --accept-data-loss`; user directed the switch to migrations for all future schema changes |
| Skill distribution (v1) | One portable `SKILL.md` (open Agent Skills standard, §5.3) — no per-agent adapters. `padock init-skill` writes it to `.agents/skills/`, `~/.agents/skills/`, and `~/.claude/skills/`, no marketplace | The standard is natively supported by Claude Code, Codex CLI, and Gemini CLI already — one file reaches all three. Keeps Skill and CLI versions in lockstep automatically; avoids a second release pipeline pre-launch |

## 7. Open decisions (deferred, not blocking Phase 0–3)

- **Non-interactive/scheduled agent support**: v1 assumes a human is always present in the agent's session (§6). Supporting unattended agents later requires designing a server-side approval queue/notification mechanism for confirm-before-act (§4) — a real, currently-unscoped piece of work, not a detail. (Per-domain PAT scoping shipped in Phase 6 independently of this — it didn't need to wait.)
- **Finer-grained PAT scopes** (per-project, per-action-verb beyond read/write): Phase 6 shipped per-domain read/write only. Revisit if a real use case needs narrower slicing (e.g. a key scoped to one specific project, not the whole `task`/`doc` domain).
- **Enterprise directory login (LDAP/AD)**: no official Better Auth LDAP plugin exists (§5.1.1). Near-term path is the SSO plugin (SAML/OIDC) fronting the directory via an IdP; revisit raw LDAP bind only if a real deployment proves the SSO path insufficient.

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

1. **Phase 0 — Platform skeleton**: Turborepo scaffold, auth (Better Auth + API Key/Organization plugins, dual-track cookie/bearer), `Project` entity, Postgres+Redis+storage wiring, docker-compose (`app`/`realtime`/`worker` roles).
2. **Phase 1 — Thin vertical slice**: DM-only chat, fixed-enum task status, Markdown docs — all Project-scoped per §5.1.2–5.1.3 — enough for §8 to run manually via the web UI / direct API calls.
3. **Phase 2 — Padock CLI**: implement the command grammar in §5.2 (incl. `padock login` manual-token flow, `tsvector` search) against the Phase 1 API.
4. **Phase 3 — Universal Agent Skill**: one portable `SKILL.md` (§5.3, the open Agent Skills standard — no per-agent adapters needed), `padock init-skill` distributing it to Claude Code/Codex CLI/Gemini CLI's discovery paths in one shot; dogfeed the §8 scenario end-to-end with a real subscription agent (Claude Code, since that's the maintainer's daily driver — §6 first validation target), but the artifact itself isn't Claude-specific.
5. **Phase 4 — Deepen each domain** — **done**: channels/threads for chat (§5.1.4), configurable workflows for tasks (§5.1.5), block-based doc storage (§5.1.7), plus the switch to `prisma migrate` (§5.1.6) that came out of doing this with live dogfood data. Sequenced one slice at a time rather than simultaneously, per this session's choice.
6. **Phase 5 — Optional richer transport & marketplace distribution**: MCP server wrapper (`padock mcp serve`) — **done**, §5.3. Publishing to agentskills.io/an official marketplace is still open — a human/business decision, not engineering work.
7. **Phase 6 — Non-interactive agents & fine-grained permissions**: PAT granular scopes (per-domain read/write, §5.1.1/§6) — **done**. Server-side approval queue for confirm-before-act, for when unattended/scheduled agents are actually in scope, is still open (§7).

## 10. Non-goals (v1)

- No third-party SaaS integrations (Slack/Notion/Jira/etc.) — explicitly out of scope; Padock is the tool, not a connector hub.
- No multi-tenant SaaS hosting.
- No full realtime multi-cursor collaborative document editing in v1 (decided in §6: single-user editing + version history first; CRDT later, transport designed to accommodate it).
- No semantic/vector search in v1 (§5.1.3, §6) — full-text only, to avoid an embedding-model dependency.
- No non-interactive/scheduled agent support in v1 (§6, §7) — every agent action happens in a live session with a human present; still an open Phase 6 item (the approval-queue half).
- No per-resource-instance PAT scoping in v1 (§7) — Phase 6 shipped per-domain read/write; per-project or finer slicing is deferred.
- No configurable task workflows in v1 (§5.1.3) — fixed four-state enum only.
- No chat channels/threads in v1 (§5.1.3) — DM only.
- No raw LDAP bind in v1 (§5.1.1, §7) — enterprise SSO (SAML/OIDC via Better Auth's SSO plugin) is the supported enterprise-auth path; direct LDAP only if later proven necessary.

## 11. Naming reference note

"Padock" — treat as the project's proper name throughout; this doc uses it consistently to anchor future docs/ADRs.
