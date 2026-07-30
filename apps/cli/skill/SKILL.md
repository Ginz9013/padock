---
name: padock
description: Use when the user wants to work with a Padock workspace — find or search project info (docs/tasks/chat), create or update tasks, read or write docs, or message a colleague. Triggers on requests like "find X in project Y", "what's the status of...", "mark this task as done/review", "send this to <colleague>".
version: 0.8.0
---

# Padock

Padock is a self-hosted workspace (chat + tasks + docs) operated through
the `padock` CLI. This skill teaches you when and how to shell out to it.

## Before you start

Check you're logged in: run `padock whoami`. If it fails, the user needs
to log in first:

    padock login --token=<key> --server=<url>

`<key>` is a Padock API key. There's no settings-page UI yet (Phase 1
shipped API-only) — get one by asking the user to run this while signed
into the Padock web UI in a browser:

    curl -X POST <url>/api/auth/api-key/create -H "Content-Type: application/json" \
      -H "Origin: <url>" --data '{"name":"cli"}'

This creates a key with full access (every command below works). Keys
can also be scoped to specific `resource:action` pairs (e.g.
`task:read`, `doc:read`) — that requires a signed-in browser session
(the web UI's "Create API key" scopes field), not this curl one-liner,
since scoped key creation is a human setup step, same as `padock login`
itself. If a command fails with `API key lacks '<action>' scope for
'<resource>'`, the logged-in key is scoped and doesn't cover that
action — ask the user for a broader key rather than retrying. Note
that name-based lookups (`--project=<name>`, `--channel=<name>`, etc.)
resolve through that domain's own `list` call, so a scoped key
practically needs `project:read` alongside whatever domain it's meant
to touch.

## Commands

    padock project create <name>
    padock project list
    padock project members <project>
    padock project add-member <project> --user=<email|name> [--role=admin|member]
    padock project remove-member <project> --user=<email|name>
    padock task create --project=<name> --title=<title> [--description=<text>] [--priority=<p>] [--start-date=<date>] [--end-date=<date>] [--assignees=<email|name>,...]
    padock task list --project=<name>
    padock task update <id> --status=<state-name>
    padock task priority <id> --value=urgent|high|medium|low|none
    padock task dates <id> [--start=<date>] [--end=<date>] [--clear-start] [--clear-end]
    padock task assignees <id> --set=<email|name>,...
    padock task-state create --project=<name> --name=<name> --group=backlog|unstarted|started|completed|cancelled [--default]
    padock task-state list --project=<name>
    padock doc create --project=<name> --title=<title> (--content=<text> | --file=<path>)
    padock doc list --project=<name>
    padock doc get <id>
    padock doc update <id> [--title=<title>] (--content=<text> | --file=<path>)
    padock channel create <title> [--project=<name>]
    padock channel list [--project=<name>]
    padock chat send --to=<email|name> --message=<text> [--project=<name>]
    padock chat send --channel=<name> --message=<text> [--project=<name>]
    padock chat conversation --with=<email|name>
    padock chat history --channel=<name> [--project=<name>]
    padock chat inbox
    padock user list
    padock search "<query>" [--scope=docs,tasks,chat] [--project=<name>]
    padock approvals list
    padock approvals status <id>

`--project`/`--to`/`--channel`/`--user` accept a name or email — no need
to know internal ids. Every command prints JSON.

**Project access is membership-gated.** `project list` only shows
projects you're a member of, and every task/doc/channel/chat command
scoped to a project requires you to already be one of its members —
`project members <project>` shows who's in it, `project add-member`
(admin-only) adds someone. The project's creator is auto-added as its
first admin; existing projects had every then-current user added as
admin when this model shipped, but new projects start with just the
creator. If a project-scoped command fails with "Not a member of this
project", that's why — ask a project admin to add you (or the user
you're acting for), don't retry.

Task assignees must already be members of the task's own project —
`task assignees <id> --set=...` (or `--assignees=...` on `task create`)
rejects anyone who isn't, naming who failed.

Chat is either a DM (`--to`) or a channel message (`--channel`), never
both. Every project gets one auto-created default channel ("project
channel") on creation, plus whatever extra "issue channels" get created
with `channel create --project=<name>` for specific discussions — a
channel must exist before you can send to it, it never materializes
implicitly from a message send. Channels can also be org-wide (omit
`--project`) and stay open to everyone, same as before — but a
project-scoped channel is now membership-gated like everything else in
that project: pass `--project=<name>` on `chat send --channel=`/`chat
history` to resolve one by name (needed once there's more than one
channel with that title across different projects), and you'll get
"Not a member of this project" if you're not actually in it.

Task states are per-project, not a fixed set — `--status` on `task
update` takes whatever state names that task's project actually has.
Every project gets six defaults when created (Backlog, Todo, In
Progress, In Review, Done, Cancelled — "Todo" is where new tasks land),
and projects can define their own on top with `task-state create`. If
`padock task update <id> --status=X` fails because `X` doesn't exist,
run `padock task-state list --project=<name>` to see what's actually
available in that task's project.

## If a write returns `{"status":"pending_approval","approvalId":"..."}`

This only happens if the logged-in key was created with "unattended"
checked (a scheduled/cron-agent key, not the normal default) — the
write didn't run yet. A human has to approve it on the web `/approvals`
page before it takes effect. Don't retry the command; if you need to
know whether it went through, check `padock approvals status <id>`
later. This is expected behavior for an unattended key, not an error.

## MCP alternative

If your runtime speaks MCP, `padock mcp serve` starts an MCP server
(stdio) exposing this same command grammar as tools (`project_list`,
`task_update`, `chat_send`, `search`, etc. — one tool per command
above). It reuses the same `padock login` config, so no separate setup.
Prefer it over shelling out to `padock` when MCP tool calls are
available; the shell commands above still work everywhere else.

## Before sending a message or changing a task's status

These are outward-facing/state-changing actions — confirm with the user
before running them, don't fire them autonomously mid-analysis.

## Example (the shape most requests take)

User: "Find the launch doc in Q3 Launch, tell me what it says, and if it
looks fine send a summary to Bob and mark the announcement task as review."

1. `padock search "launch" --project="Q3 Launch"` — read the results yourself.
2. Summarize for the user; wait for confirmation.
3. `padock chat send --to=bob@... --message="<summary>" --project="Q3 Launch"`
4. `padock task update <id> --status=review`
