# Issue tracker: Linear

Tickets live in Linear, team `LINEAR_TEAM` (`project.md`). Use the MCP
server named by `LINEAR_MCP` (tools `mcp__<LINEAR_MCP>__*`) for every
operation. If they aren't loaded, load them with ToolSearch; if they
fail to connect, ask the user to run `/mcp` and authenticate that
server. Never use another Linear server that happens to be loaded.

Below, `T` is `LINEAR_TEAM`.

## Workspaces

Linear's MCP endpoint is one workspace per authentication, so each
Linear account (work, private) is its own named server. Register each
repo's server in its `.mcp.json`, named after the workspace, not
`linear-server`, so credentials never collide across repos:

```json
{
  "mcpServers": {
    "linear-work": {
      "type": "http",
      "url": "https://mcp.linear.app/mcp"
    }
  }
}
```

Then `/mcp` once per server to complete OAuth. For unattended runs,
an API key from that workspace avoids the browser flow:

```json
"headers": { "Authorization": "Bearer ${LINEAR_WORK_API_KEY}" }
```

## Operations

- **Create**: in team `T`, with a title, markdown description, and
  `REPO_LABEL` if the project defines one.
- **Read**: by identifier (`T-<n>`), with comments and labels.
- **List**: team `T`, filtered by state, triage label and `REPO_LABEL`.
- **Comment / label**: by name (`triage-labels.md`). Create a missing
  label once in team `T`; never duplicate.
- **Claim**: assign to yourself and move to In Progress. This is the
  first write a session makes, before reading anything further.
- **Release**: unassign, move back to Todo, comment why.
- **In review**: move to In Review once its PR is open. The PR
  carries the ticket from here until merge; `Closes T-<n>` moves it to Done.
- **Close**: move to Done (Canceled for `wontfix`) with a comment naming
  the merged PR.
- **Blockers**: Linear's native "blocked by" relations. A ticket is
  unblocked when every blocker is `completed` or `canceled`.
- **Sub-issues**: Linear parent/child.

## The agent queue

`task-implementer` and `pr-reviewer` work only issues labelled
`ready-for-agent` (plus `REPO_LABEL` when set). Nothing else is a
candidate or counts as in flight.

A ticket's `Source:` footer names its `plan.md`. It is resolved through
`SPEC_DIR`: when intents live outside the repo (a sibling repo, a
parent workspace), `project.md` says how the footer's path maps onto
the checkout.

## PR naming

Every PR names its ticket three ways: branch `feat/<t>-<n>-<short-slug>`
(lowercase), title `T-<n>: <title>`, and a `Closes T-<n>` line on its
own at the top of the body. The body line closes the ticket on merge
through Linear's GitHub integration. A change spanning several repos has
one PR per repo; all but the last to merge say `Part of T-<n>` instead.

**After a merge**, whoever merged checks the ticket reached Done. If the
integration didn't move it, close it by hand with `Merged in <PR URL>.`
