---
name: next-ticket
description: Entry point invoked by a polling loop (or a person) to pick up implementation work from the Linear ticket queue. Claims every unit of work the lanes allow this tick — each `changes-requested` PR without `wip`, plus as many unblocked, lane-disjoint `ready-for-agent` tickets as fit under `MAX_IN_FLIGHT` — then spawns one `task-implementer` subagent per claim, all in parallel, each in its own isolated worktree. Use when a scheduler checks for new work on an interval, or someone asks to "grab the next ticket", "pick up work" or "work the queue".
---

# Next Ticket

Dispatcher for the implementation half of the pipeline. It decides and
claims the whole batch for this tick, serially, then fans out one
`task-implementer` subagent (`${CLAUDE_PLUGIN_ROOT}/agents/`) per claim. Context
loading and implementation live in the subagent.

Run it from the repo that builds the tickets. `docs/agents/project.md`
there defines `LINEAR_MCP`, `LINEAR_TEAM` (`T` below), `REPO_LABEL`,
`MAX_IN_FLIGHT` and optionally `MAX_SPAWN` (per-tick cap; default: no
cap beyond `MAX_IN_FLIGHT`). Ticket operations are in
`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md`. Nothing project-specific belongs in
this file.

## Process

1. **Check for an explicit ticket.** If the caller passed `T-<n>`, the
   batch is that ticket alone (still validated in step 5). Skip the
   fix-queue part of step 5.

2. **Run the stale-claim sweep** before claiming anything
   (`${CLAUDE_PLUGIN_ROOT}/docs/pipeline-housekeeping.md`). A crashed session
   leaves a ticket assigned with no PR behind it, or a `wip` label on a
   PR it was fixing. Either one blocks work against every later tick,
   including this one. Release what qualifies; released work is a
   candidate for this very tick.

3. **Run the review-loop watchdog** (same file). The review loop can't
   report its own death, and while it is dead this loop only idles.

4. **Run the spawn pre-check** (same file). If it says don't spawn,
   report `Skipped spawn: <reason>` verbatim as the first line, then
   anything the sweep or watchdog did, and stop.

5. **Plan the batch.** Re-fetch the open PRs and the Linear queue
   (fresh, not the sweep's snapshot). Compute the in-flight count and
   occupied set exactly as `${CLAUDE_PLUGIN_ROOT}/agents/task-implementer.md` § Concurrency defines
   them. Then, in order:

   - **Fix work.** Every open `changes-requested` PR without `wip` is
     one batch item. Its lane is already occupied by the PR itself, so
     it neither adds to the in-flight count nor needs a free lane.
   - **New tickets.** Take unassigned, unblocked `ready-for-agent`
     tickets oldest `createdAt` first. Add one to the batch only if its
     `## Touches` is disjoint from the occupied set **and** from every
     ticket already in the batch, and in-flight + batched tickets does
     not exceed `MAX_IN_FLIGHT`. Each one you add joins the occupied set.
     A ticket that counts as `**` (no `## Touches`, or one that
     collides with `PIPELINE_PATHS`; `${CLAUDE_PLUGIN_ROOT}/agents/task-implementer.md` §
     Concurrency): take it only if nothing is in flight and the batch
     is empty, and then take nothing else.
   - Stop adding once the batch reaches `MAX_SPAWN`, if set.

   Skipping a colliding ticket and taking a younger one that fits is
   intended: it is how the tick packs lanes. Never take a blocked,
   assigned or colliding ticket.

6. **Claim every batch item here, one at a time, before spawning
   anything.** This is the only place claims happen for a batch, which
   is what makes the fan-out safe: no subagent ever snapshots the queue.

   - PR: `gh pr edit <n> --add-label wip`. If `wip` was already there,
     another loop got it; drop it from the batch.
   - Ticket: assign to yourself and move to In Progress
     (`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md` → Claim). Re-read it; if the assignee isn't
     you, another loop won the race: drop it and release nothing.

   If the batch is empty after claiming, report why and stop.

7. **Don't pull, branch or prepare a base here.** Each `task-implementer`
   fetches and cuts its own branch from `origin/main` inside a worktree
   it makes itself. Whichever branch this session sits on must not
   decide what a ticket is built on.

8. **Spawn one `task-implementer` per claimed item, all in a single
   message** (several Agent tool calls in one response) so they run
   concurrently. Each prompt names exactly one item and says it is
   already claimed:

   - `Dispatched: fix PR #<n>. Already labelled wip by the dispatcher.`
   - `Dispatched: ticket T-<n>. Already assigned to you and In Progress.`

   Use the Agent tool with `subagent_type: feature-factory:task-implementer`,
   never the Skill tool: each implementer needs its own context to make and remove its own worktree.
   Don't pass `isolation: "worktree"`: the implementer makes its own
   worktree under `$TMPDIR`, and creating one from inside a harness
   worktree is the nested-worktree case the sandbox blocks.

9. **Report each implementer's result as-is**, one line per item: PR
   opened, `changes-requested` PR handed back, or why it stopped. Then
   one count line: `Spawned <k>: <f> fixes, <t> tickets. Left in queue:
   <m> (<reason: lane collision | MAX_IN_FLIGHT | MAX_SPAWN | blocked>).`
   A tick that claims nothing is a normal tick. Don't retry with relaxed
   criteria.

## Why the dispatcher claims

Assignment in Linear (and `wip` on a PR) is the single source of truth
for ownership. If several implementers each picked their own ticket,
they would all snapshot the queue before any claim landed and could
pick the same ticket or colliding lanes. Doing selection and claiming
serially in one place, then spawning, removes that race inside a tick.
Across independent loops the claim re-read in step 6 is the guard, as
before.

A spawned implementer that crashes leaves its claim behind; the
stale-claim sweep on a later tick returns it to the queue.
