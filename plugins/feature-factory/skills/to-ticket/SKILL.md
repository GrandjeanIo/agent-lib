---
name: to-ticket
description: Break docs/intent/<slug>/plan.md into tracer-bullet Linear issues, wired with real blocking relations and declared touch sets — stage 3 of the intent → plan → tickets flow, and the pipeline's last human gate.
disable-model-invocation: true
---

# To Ticket

Turns a plan into Linear issues so `/next-ticket` can later ask the
tracker two questions with no human present:

1. **What is unblocked?** — answered by real blocking relations.
2. **What is safe to start alongside what's in flight?** — answered
   by each ticket's declared touch set.

Both are decided here. An agent at 3am cannot tell that two tickets
will both rewrite the auth middleware. You can.

Read `docs/agents/project.md` (`LINEAR_MCP`, `LINEAR_TEAM` = `T`,
`REPO_LABEL`, `SPEC_DIR`, `SHARED_GLOBS`, `PIPELINE_PATHS`,
`SENSITIVE_PATHS`) and
`${CLAUDE_PLUGIN_ROOT}/docs/issue-tracker.md` first.

## Process

### 1. Gather context

If the user passed a slug or number, use that directory. Otherwise
take the newest `plan.md` whose `## Tickets` section is empty, and
confirm it. Read `plan.md` in full, plus `intent.md` (and `spec.md` if
present) for context. No `plan.md` → use `intent.md` and tell the user
they're skipping the design stage for a small change.

### 2. Verify against the codebase

Confirm the plan's file list still matches the code. Respect ADRs in
the area. Touch sets in step 4 are drawn from this pass. Check whether
a slice will need a helper or loader under `SENSITIVE_PATHS` that the
plan doesn't name (a shared loader the feature reads through, say); if
so, its touch set must include that path, so the escalation is visible
now rather than at review.

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets:

- Each slice cuts a narrow but complete path through every layer it
  touches — vertical, not one layer.
- A completed slice is demoable or verifiable on its own.
- Each slice fits in a single fresh context window.
- Any prefactoring comes first.

Give each ticket its **blockers**: tickets that must complete before
it can start.

**Wide refactors** — one mechanical change whose blast radius spans
the codebase — are the exception. Sequence as expand–contract: expand
(add the new form beside the old), migrate (call sites in batches, one
ticket each, blocked by expand), contract (delete the old form,
blocked by every batch).

**Several repos.** When `REPO_LABEL` lists more than one label, the
project spans repos. A slice stays inside one repo: a plan whose files
span two repos yields one ticket per repo, each labelled by the repo
its `## Touches` are in, never both. `project.md` says which depends on
which; block the dependent one and say in its body what it waits for.

### 4. Declare touch sets

Every ticket gets a **touch set**: coarse globs covering what it will
modify, relative to its own repo. Directory-level (`src/auth/**`), not
file lists. Err wide.

Two tickets can run concurrently when no dependency path joins them
**and** their touch sets are disjoint (the rule is in
`${CLAUDE_PLUGIN_ROOT}/agents/task-implementer.md`). Use `**` for a ticket that
must run alone: anything touching `PIPELINE_PATHS`, and usually
migrate batches. A ticket that adds a file under a `SHARED_GLOBS` entry
declares that whole glob.

### 5. Review with the user

Present a numbered list. Per ticket: **Title**, **Repo** (if several),
**Blocked by**, **Touches**, **Sensitive** (yes when `## Touches`
overlaps `SENSITIVE_PATHS` or `PIPELINE_PATHS`: its PR escalates to a
person instead of merging), **What it delivers** (the thing you'd
demo). Then one line: ticket count, widest set that can run at once,
critical-path length, how many will escalate on review. If nothing can run in parallel, say so and ask
whether any can be split.

Ask: granularity right? Blocking edges correct? Any touch sets
overlapping that shouldn't, or disjoint that shouldn't? Iterate until
approved. Nothing is published before this.

### 6. Publish, one ticket at a time, in dependency order

Walk the tickets topologically so blockers exist before edges are
wired. For each ticket, finish all three before the next:

1. Create the issue in team `T` with the template below, labelled
   `ready-for-agent` plus its repo label.
2. Append `T-<n>` and its URL to `## Tickets` in `plan.md`.
3. Add its "blocked by" relations in Linear. Prose isn't enough;
   `task-implementer` reads the relations.

Per-ticket rather than in phases, so an interrupted run leaves a
consistent state. On re-run, skip tickets already in `## Tickets`.

<issue-template>

## What to build

The end-to-end behaviour this ticket makes work, from the user's
perspective.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Touches

- `src/example/**`
- `tests/example/**`

---

Source: `docs/intent/<NNN-slug>/plan.md`

</issue-template>

Write the `Source:` path the way `SPEC_DIR` in `project.md` says (it
may be relative to a parent folder when intents live outside the repo
that builds the ticket). Each criterion must be checkable without the
plan in hand: a command the gate runs, or an observable behaviour. Keep
file paths and code out of **What to build**; `## Touches` is the
deliberate exception, a claim boundary rather than an instruction.

### 7. Report

Confirm `## Tickets` lists every issue in dependency order. Tell the
user how many tickets exist, how many are unblocked now, and that
`/feature-factory:next-ticket` from the repo that builds them will claim one whose
touch set is free. Nothing to update in `intent.md`: a non-empty
`## Tickets` is what marks the intent ticketed.
